import { createHash } from 'crypto';
import { isOverheadAmount } from './dto/overhead-amount.validator';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { isCostPurpose } from '../../../common/cost-purpose/cost-purpose.constants';
import {
  OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY,
  OPERATIONAL_OVERHEAD_ENTRY_INCLUDE,
  OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY,
  isOverheadCategory,
} from './operational-overhead.constants';
import {
  CloseOverheadPeriodDto,
  CreateOverheadPeriodDto,
  OpenOverheadPeriodDto,
  OverheadPeriodQueryDto,
  UpdateOverheadPeriodDto,
} from './dto/overhead-period.dto';
import {
  CreateOverheadEntryDto,
  FinalizeOverheadEntryDto,
  OverheadEntryQueryDto,
  UpdateOverheadEntryDto,
} from './dto/overhead-entry.dto';

const PERIODS_LOCK_PREFIX = 'ATSOFT:OVERHEAD:PERIODS:';

@Injectable()
export class OperationalOverheadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private scope(ctx: ActiveOperationalContext) {
    if (!ctx?.companyId || !ctx?.branchId || ctx.companyId.length > 200 || ctx.branchId.length > 200) {
      throw this.badRequest('operationalContext.headersRequired');
    }
    return { companyId: ctx.companyId, branchId: ctx.branchId, companyKey: ctx.companyId, branchKey: ctx.branchId };
  }

  private writeBoundary<T>(ctx: ActiveOperationalContext, work: (tx: any) => Promise<T>): Promise<T> {
    this.scope(ctx);
    // Hash names only partition locks; collisions can only serialize extra work, never weaken uniqueness.
    // Fixed width also avoids sp_getapplock resource truncation on long tenant IDs.
    const boundary = createHash('sha256').update(JSON.stringify([ctx.companyId, ctx.branchId])).digest('hex');
    return this.prisma.$transaction(async (tx: any) => {
      await this.acquireLock(tx, PERIODS_LOCK_PREFIX + boundary);
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 });
  }

  private amount(value: unknown): Prisma.Decimal {
    if (!isOverheadAmount(value)) throw this.badRequest('overhead.amountInvalid');
    return new Prisma.Decimal(String(value));
  }

  private writeAudit(
    client: any,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    details: Record<string, any>,
  ) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async acquireLock(tx: any, resource: string): Promise<void> {
    const result: Array<{ result: number }> = await tx.$queryRaw`
      DECLARE @res int;
      EXEC @res = sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
      SELECT @res AS result;
    `;
    const status = result?.[0]?.result;
    if (status !== 0 && status !== 1) {
      throw new ConflictException({
        messageKey: 'overhead.concurrencyConflict',
        message: 'overhead.concurrencyConflict',
      });
    }
  }

  private async assertCompanyCurrency(client: any, companyId: string): Promise<string> {
    const company: any = await client.company.findUnique({ where: { id: companyId } });
    if (!company) throw this.notFound('common.companyNotFound');
    const code = company.operationalCurrencyCode;
    if (!code || !/^[A-Z]{3}$/.test(code)) {
      throw this.badRequest('overhead.currencyNotConfigured');
    }
    return code;
  }

  private async assertTenantScopedCostCenter(
    client: any,
    id: string,
    ctx: ActiveOperationalContext,
    errorKey: string,
  ): Promise<any> {
    const cc: any = await client.costCenter.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
    });
    if (!cc || cc.deletedAt || cc.companyId !== ctx.companyId || (cc.branchId && cc.branchId !== ctx.branchId)) throw this.notFound(errorKey);
    if ((cc.status ?? 'ACTIVE') !== 'ACTIVE') throw this.badRequest(errorKey);
    return cc;
  }

  private async findPeriodScoped(client: any, id: string, ctx: ActiveOperationalContext): Promise<any> {
    const period: any = await client.operationalOverheadPeriod.findFirst({
      where: { id, ...this.scope(ctx), deletedAt: null },
    });
    if (!period) throw this.notFound('overhead.periodNotFound');
    return period;
  }

  // ── Periods ──────────────────────────────────────────────────────────────────

  async createPeriod(dto: CreateOverheadPeriodDto, userId: string, ctx: ActiveOperationalContext) {
    const from = new Date(dto.periodFrom);
    const to = new Date(dto.periodTo);
    if (!(from.getTime() < to.getTime())) {
      throw this.badRequest('overhead.periodInvalidRange');
    }

    return this.writeBoundary(ctx,
      async (tx: any) => {

        const existingOpen: any = await tx.operationalOverheadPeriod.findFirst({
          where: { ...this.scope(ctx), status: 'OPEN', deletedAt: null },
        });
        if (existingOpen) {
          throw this.conflict('overhead.periodOpenExists');
        }

        const overlap: any = await tx.operationalOverheadPeriod.findFirst({
          where: {
            ...this.scope(ctx),
            deletedAt: null,
            status: { in: ['DRAFT', 'OPEN', 'CLOSED'] },
            periodFrom: { lt: to },
            periodTo: { gt: from },
          },
        });
        if (overlap) {
          throw this.conflict('overhead.periodOverlap');
        }

        const existingCode: any = await tx.operationalOverheadPeriod.findFirst({
          where: { ...this.scope(ctx), code: dto.code, deletedAt: null },
        });
        if (existingCode) {
          throw this.conflict('overhead.periodCodeDuplicate');
        }

        const period = await tx.operationalOverheadPeriod.create({
          data: {
            ...this.scope(ctx),
            code: dto.code,
            periodFrom: from,
            periodTo: to,
            status: 'DRAFT',
            createdById: userId,
            updatedById: userId,
          },
        });

        await this.writeAudit(tx, userId, 'OVERHEAD_PERIOD_CREATE', OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY, period.id, ctx, {
          code: period.code,
          periodFrom: period.periodFrom.toISOString(),
          periodTo: period.periodTo.toISOString(),
        });

        return period;
      }
    );
  }

  async findPeriods(query: OverheadPeriodQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: any = { ...this.scope(ctx), deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.code = { contains: query.search };
    }
    const [total, items] = await Promise.all([
      this.prisma.operationalOverheadPeriod.count({ where }),
      this.prisma.operationalOverheadPeriod.findMany({
        where,
        orderBy: { periodFrom: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, total, page, limit };
  }

  async findOnePeriod(id: string, ctx: ActiveOperationalContext) {
    const period = await this.prisma.operationalOverheadPeriod.findFirst({
      where: { id, ...this.scope(ctx), deletedAt: null },
      include: {
        entries: {
          where: { deletedAt: null },
          select: {
            id: true,
            reference: true,
            overheadCategory: true,
            costPurpose: true,
            amount: true,
            currencyCode: true,
            incurredAt: true,
            status: true,
          },
          orderBy: { incurredAt: 'asc' },
          take: 100,
        },
      },
    });
    if (!period) throw this.notFound('overhead.periodNotFound');
    return period;
  }

  async updatePeriod(id: string, dto: UpdateOverheadPeriodDto, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx,
      async (tx: any) => {
        const period: any = await this.findPeriodScoped(tx, id, ctx);
        if (period.status !== 'DRAFT' && period.status !== 'OPEN') {
          throw this.conflict('overhead.periodNotEditable');
        }

        const data: any = {};
        if (dto.code !== undefined) data.code = dto.code;
        if (dto.periodFrom !== undefined) data.periodFrom = new Date(dto.periodFrom);
        if (dto.periodTo !== undefined) data.periodTo = new Date(dto.periodTo);

        if (data.code !== undefined && data.code !== period.code) {

          const existingCode: any = await tx.operationalOverheadPeriod.findFirst({
            where: { ...this.scope(ctx), code: data.code, deletedAt: null, id: { not: id } },
          });
          if (existingCode) {
            throw this.conflict('overhead.periodCodeDuplicate');
          }
        }

        const nextFrom: Date = data.periodFrom ?? period.periodFrom;
        const nextTo: Date = data.periodTo ?? period.periodTo;
        if (!(nextFrom.getTime() < nextTo.getTime())) {
          throw this.badRequest('overhead.periodInvalidRange');
        }

        if (data.periodFrom || data.periodTo) {

          const overlap: any = await tx.operationalOverheadPeriod.findFirst({
            where: {
              ...this.scope(ctx),
              deletedAt: null,
              id: { not: id },
              status: { in: ['DRAFT', 'OPEN', 'CLOSED'] },
              periodFrom: { lt: nextTo },
              periodTo: { gt: nextFrom },
            },
          });
          if (overlap) {
            throw this.conflict('overhead.periodOverlap');
          }
        }

        if (data.periodFrom || data.periodTo) {
          const outside = await tx.operationalOverheadEntry.count({ where: { periodId: id, ...this.scope(ctx), deletedAt: null, OR: [{ incurredAt: { lt: nextFrom } }, { incurredAt: { gte: nextTo } }] } });
          if (outside > 0) throw this.badRequest('overhead.entryOutOfPeriod');
        }
        data.updatedById = userId;
        const updated: any = await tx.operationalOverheadPeriod.update({ where: { id, ...this.scope(ctx) }, data });

        await this.writeAudit(tx, userId, 'OVERHEAD_PERIOD_UPDATE', OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY, id, ctx, {
          code: updated.code,
          periodFrom: updated.periodFrom.toISOString(),
          periodTo: updated.periodTo.toISOString(),
          status: updated.status,
        });

        return updated;
      }
    );
  }

  async openPeriod(id: string, dto: OpenOverheadPeriodDto, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx,
      async (tx: any) => {

        const period: any = await this.findPeriodScoped(tx, id, ctx);
        if (period.status !== 'DRAFT') {
          throw this.conflict('overhead.periodOpenInvalidState');
        }
        const existingOpen: any = await tx.operationalOverheadPeriod.findFirst({
          where: { ...this.scope(ctx), status: 'OPEN', deletedAt: null, id: { not: id } },
        });
        if (existingOpen) {
          throw this.conflict('overhead.periodOpenExists');
        }
        const updated: any = await tx.operationalOverheadPeriod.update({
          where: { id, ...this.scope(ctx) },
          data: { status: 'OPEN', updatedById: userId },
        });
        await this.writeAudit(tx, userId, 'OVERHEAD_PERIOD_OPEN', OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY, id, ctx, {
          status: 'OPEN',
          reason: dto.notes || null,
        });
        return updated;
      }
    );
  }

  async closePeriod(id: string, dto: CloseOverheadPeriodDto, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx,
      async (tx: any) => {

        const period: any = await this.findPeriodScoped(tx, id, ctx);
        if (period.status !== 'OPEN') {
          throw this.conflict('overhead.periodCloseInvalidState');
        }

        const unfinished: number = await tx.operationalOverheadEntry.count({
          where: { periodId: id, ...this.scope(ctx), deletedAt: null, status: { not: 'FINALIZED' } },
        });
        if (unfinished > 0) {
          throw this.conflict('overhead.periodCloseOpenEntries');
        }

        const updated: any = await tx.operationalOverheadPeriod.update({
          where: { id, ...this.scope(ctx) },
          data: { status: 'CLOSED', closedAt: new Date(), closedById: userId, updatedById: userId },
        });

        await this.writeAudit(tx, userId, 'OVERHEAD_PERIOD_CLOSE', OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY, id, ctx, {
          status: 'CLOSED',
          closedAt: updated.closedAt?.toISOString(),
          reason: dto.reason || null,
        });

        return updated;
      }
    );
  }

  async cancelPeriod(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx, async (tx: any) => {
      const period: any = await this.findPeriodScoped(tx, id, ctx);
      if (period.status !== 'DRAFT') {
        throw this.conflict('overhead.periodDeleteInvalidState');
      }
      const hasEntries: number = await tx.operationalOverheadEntry.count({
        where: { periodId: id, ...this.scope(ctx), deletedAt: null },
      });
      if (hasEntries > 0) {
        throw this.conflict('overhead.periodDeleteHasEntries');
      }
      const updated: any = await tx.operationalOverheadPeriod.update({
        where: { id, ...this.scope(ctx) },
        data: { status: 'CANCELLED', updatedById: userId },
      });
      await this.writeAudit(tx, userId, 'OVERHEAD_PERIOD_CANCEL', OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY, id, ctx, {
        status: 'CANCELLED',
      });
      return updated;
    });
  }

  // ── Entries ──────────────────────────────────────────────────────────────────

  async createEntry(dto: CreateOverheadEntryDto, userId: string, ctx: ActiveOperationalContext) {
    if (!isOverheadCategory(dto.overheadCategory)) {
      throw this.badRequest('overhead.categoryInvalid');
    }
    if (!isCostPurpose(dto.costPurpose)) {
      throw this.badRequest('overhead.costPurposeInvalid');
    }

    return this.writeBoundary(ctx, async (tx: any) => {
      const period: any = await this.findPeriodScoped(tx, dto.periodId, ctx);
      if (period.status !== 'OPEN') {
        throw this.conflict('overhead.periodNotOpen');
      }

      const duplicateRef: any = await tx.operationalOverheadEntry.findFirst({
        where: { periodId: period.id, ...this.scope(ctx), reference: dto.reference, deletedAt: null },
      });
      if (duplicateRef) {
        throw this.conflict('overhead.entryReferenceDuplicate');
      }

      const incurredAt = new Date(dto.incurredAt);
      const pFrom = new Date(period.periodFrom);
      const pTo = new Date(period.periodTo);
      if (!(incurredAt.getTime() >= pFrom.getTime() && incurredAt.getTime() < pTo.getTime())) {
        throw this.badRequest('overhead.entryOutOfPeriod');
      }

      await this.assertTenantScopedCostCenter(tx, dto.sourceCostCenterId, ctx, 'overhead.entrySourceCostCenterInvalid');

      const currencyCode: string = await this.assertCompanyCurrency(tx, ctx.companyId);

      const entry: any = await tx.operationalOverheadEntry.create({
        data: {
          ...this.scope(ctx),
          periodId: period.id,
          reference: dto.reference,
          overheadCategory: dto.overheadCategory,
          costPurpose: dto.costPurpose,
          description: dto.description,
          amount: this.amount(dto.amount),
          currencyCode,
          incurredAt,
          sourceCostCenterId: dto.sourceCostCenterId,
          sourceCostCenterKey: dto.sourceCostCenterId,
          status: 'DRAFT',
          notes: dto.notes,
          externalDocumentReference: dto.externalDocumentReference,
          createdById: userId,
          updatedById: userId,
        },
      });

      await this.writeAudit(tx, userId, 'OVERHEAD_SOURCE_CREATE', OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY, entry.id, ctx, {
        periodId: period.id,
        reference: entry.reference,
        overheadCategory: entry.overheadCategory,
        costPurpose: entry.costPurpose,
        amount: entry.amount.toString(),
        currencyCode: entry.currencyCode,
        sourceCostCenterId: entry.sourceCostCenterId,
        incurredAt: entry.incurredAt.toISOString(),
      });

      return entry;
    });
  }

  async findEntries(query: OverheadEntryQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = { ...this.scope(ctx), deletedAt: null };
    if (query.periodId) {
      const period: any = await this.prisma.operationalOverheadPeriod.findFirst({
        where: { id: query.periodId, ...this.scope(ctx), deletedAt: null },
      });
      if (!period) throw this.notFound('overhead.periodNotFound');
      where.periodId = query.periodId;
    }
    if (query.overheadCategory) where.overheadCategory = query.overheadCategory;
    if (query.costPurpose) where.costPurpose = query.costPurpose;
    if (query.status) where.status = query.status;
    if (query.sourceCostCenterId) where.sourceCostCenterKey = query.sourceCostCenterId;
    if (query.search) {
      where.OR = [{ reference: { contains: query.search } }, { description: { contains: query.search } }];
    }
    const [total, items] = await Promise.all([
      this.prisma.operationalOverheadEntry.count({ where }),
      this.prisma.operationalOverheadEntry.findMany({
        where,
        include: OPERATIONAL_OVERHEAD_ENTRY_INCLUDE,
        orderBy: { incurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, total, page, limit };
  }

  async findOneEntry(id: string, ctx: ActiveOperationalContext) {
    const entry: any = await this.prisma.operationalOverheadEntry.findFirst({
      where: { id, ...this.scope(ctx), deletedAt: null },
      include: OPERATIONAL_OVERHEAD_ENTRY_INCLUDE,
    });
    if (!entry) throw this.notFound('overhead.entryNotFound');
    return entry;
  }

  async updateEntry(id: string, dto: UpdateOverheadEntryDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.overheadCategory !== undefined && !isOverheadCategory(dto.overheadCategory)) {
      throw this.badRequest('overhead.categoryInvalid');
    }
    if (dto.costPurpose !== undefined && !isCostPurpose(dto.costPurpose)) {
      throw this.badRequest('overhead.costPurposeInvalid');
    }

    return this.writeBoundary(ctx, async (tx: any) => {
      const entry: any = await tx.operationalOverheadEntry.findFirst({
        where: { id, ...this.scope(ctx), deletedAt: null },
      });
      if (!entry) throw this.notFound('overhead.entryNotFound');
      if (entry.status !== 'DRAFT') {
        throw this.conflict('overhead.entryNotEditable');
      }
      const period: any = await tx.operationalOverheadPeriod.findFirst({
        where: { id: entry.periodId, ...this.scope(ctx), deletedAt: null },
      });
      if (!period) throw this.notFound('overhead.periodNotFound');
      if (period.status !== 'OPEN') {
        throw this.conflict('overhead.periodNotOpen');
      }

      const data: any = {};
      if (dto.reference !== undefined) {

        if (dto.reference !== entry.reference) {
          const duplicateRef: any = await tx.operationalOverheadEntry.findFirst({
            where: {
              periodId: entry.periodId,
              ...this.scope(ctx),
              reference: dto.reference,
              deletedAt: null,
              id: { not: id },
            },
          });
          if (duplicateRef) {
            throw this.conflict('overhead.entryReferenceDuplicate');
          }
        }
        data.reference = dto.reference;
      }
      if (dto.overheadCategory !== undefined) data.overheadCategory = dto.overheadCategory;
      if (dto.costPurpose !== undefined) data.costPurpose = dto.costPurpose;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.amount !== undefined) data.amount = this.amount(dto.amount);
      if (dto.sourceCostCenterId !== undefined) {
        await this.assertTenantScopedCostCenter(tx, dto.sourceCostCenterId, ctx, 'overhead.entrySourceCostCenterInvalid');
        data.sourceCostCenterId = dto.sourceCostCenterId;
        data.sourceCostCenterKey = dto.sourceCostCenterId;
      }
      if (dto.incurredAt !== undefined) {
        const incurredAt = new Date(dto.incurredAt);
        const pFrom = new Date(period.periodFrom);
        const pTo = new Date(period.periodTo);
        if (!(incurredAt.getTime() >= pFrom.getTime() && incurredAt.getTime() < pTo.getTime())) {
          throw this.badRequest('overhead.entryOutOfPeriod');
        }
        data.incurredAt = incurredAt;
      }
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.externalDocumentReference !== undefined) data.externalDocumentReference = dto.externalDocumentReference;

      data.updatedById = userId;
      const updated: any = await tx.operationalOverheadEntry.update({ where: { id, ...this.scope(ctx) }, data });

      await this.writeAudit(tx, userId, 'OVERHEAD_SOURCE_UPDATE', OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY, id, ctx, {
        periodId: updated.periodId,
        reference: updated.reference,
        overheadCategory: updated.overheadCategory,
        costPurpose: updated.costPurpose,
        amount: updated.amount.toString(),
        currencyCode: updated.currencyCode,
        sourceCostCenterId: updated.sourceCostCenterId,
      });

      return updated;
    });
  }

  async finalizeEntry(id: string, dto: FinalizeOverheadEntryDto, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx,
      async (tx: any) => {
        const entry: any = await tx.operationalOverheadEntry.findFirst({
          where: { id, ...this.scope(ctx), deletedAt: null },
        });
        if (!entry) throw this.notFound('overhead.entryNotFound');
        if (entry.status !== 'DRAFT') {
          throw this.conflict('overhead.entryAlreadyFinalized');
        }
        const period: any = await tx.operationalOverheadPeriod.findFirst({
          where: { id: entry.periodId, ...this.scope(ctx), deletedAt: null },
        });
        if (!period) throw this.notFound('overhead.periodNotFound');
        if (period.status !== 'OPEN') {
          throw this.conflict('overhead.periodNotOpen');
        }

        if (entry.currencyCode !== ((await this.assertCompanyCurrency(tx, ctx.companyId)))) {
          throw this.conflict('overhead.currencyMismatch');
        }

        const updated: any = await tx.operationalOverheadEntry.update({
          where: { id, ...this.scope(ctx) },
          data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: userId, updatedById: userId },
        });

        await this.writeAudit(tx, userId, 'OVERHEAD_SOURCE_FINALIZE', OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY, id, ctx, {
          periodId: updated.periodId,
          reference: updated.reference,
          amount: updated.amount.toString(),
          currencyCode: updated.currencyCode,
          note: dto.notes || null,
        });

        return updated;
      }
    );
  }

  async deleteEntry(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.writeBoundary(ctx, async (tx: any) => {
      const entry: any = await tx.operationalOverheadEntry.findFirst({
        where: { id, ...this.scope(ctx), deletedAt: null },
      });
      if (!entry) throw this.notFound('overhead.entryNotFound');
      if (entry.status !== 'DRAFT') {
        throw this.conflict('overhead.entryNotDeletable');
      }
      const period: any = await tx.operationalOverheadPeriod.findFirst({
        where: { id: entry.periodId, ...this.scope(ctx), deletedAt: null },
      });
      if (!period) throw this.notFound('overhead.periodNotFound');
      if (period.status !== 'OPEN') {
        throw this.conflict('overhead.periodNotOpen');
      }

      const updated: any = await tx.operationalOverheadEntry.update({
        where: { id, ...this.scope(ctx) },
        data: { deletedAt: new Date(), updatedById: userId },
      });

      await this.writeAudit(tx, userId, 'OVERHEAD_SOURCE_DELETE', OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY, id, ctx, {
        periodId: entry.periodId,
        reference: entry.reference,
        amount: entry.amount.toString(),
      });

      return updated;
    });
  }
}
