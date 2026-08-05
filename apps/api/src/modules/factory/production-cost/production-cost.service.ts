import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  OPERATIONAL_COST_RATE_AUDIT_ENTITY,
  OPERATIONAL_COST_RATE_INCLUDE,
  OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY,
  OPERATIONAL_COST_SNAPSHOT_INCLUDE,
  OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY,
  OPERATIONAL_COST_TRANSACTION_INCLUDE,
} from './production-cost.constants';
import { CostRateQueryDto, CreateCostRateDto, UpdateCostRateDto } from './dto/cost-rate.dto';
import {
  CostSnapshotQueryDto,
  CreateCostSnapshotDto,
  FreezeCostSnapshotDto,
  SupersedeCostSnapshotDto,
  UpdateCostSnapshotDto,
} from './dto/cost-snapshot.dto';
import { CostTransactionQueryDto, PostCostTransactionDto, ReverseCostTransactionDto } from './dto/cost-transaction.dto';

@Injectable()
export class ProductionCostService {
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

  private async assertTenantScoped(client: any, model: string, id: string, ctx: ActiveOperationalContext, errorKey: string) {
    const record = await client[model].findUnique({ where: { id } });
    if (!record) throw this.notFound(errorKey);
    if (record.companyId !== ctx.companyId) throw this.badRequest('common.tenantMismatch');
    if (record.branchId && record.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');
    return record;
  }

  private async resolveCostLinks(
    client: any,
    ctx: ActiveOperationalContext,
    links: { productionLineId?: string; machineId?: string; costCenterId?: string },
    errorPrefix: string,
  ) {
    const resolved: Record<string, string> = {};
    if (links.productionLineId) resolved.productionLineId = (await this.assertTenantScoped(client, 'productionLine', links.productionLineId, ctx, `${errorPrefix}.lineNotFound`)).id;
    if (links.machineId) resolved.machineId = (await this.assertTenantScoped(client, 'machine', links.machineId, ctx, `${errorPrefix}.machineNotFound`)).id;
    if (links.costCenterId) resolved.costCenterId = (await this.assertTenantScoped(client, 'costCenter', links.costCenterId, ctx, `${errorPrefix}.costCenterNotFound`)).id;
    return resolved;
  }

  // ── Cost rates ──────────────────────────────────────────────────────────────

  async createRate(dto: CreateCostRateDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostRate');
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw this.badRequest('productionCostRate.invalidEffectiveRange');
      }
      try {
        const rate = await tx.operationalCostRate.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            code: dto.code,
            nameAr: dto.nameAr,
            nameEn: dto.nameEn,
            description: dto.description ?? null,
            costType: dto.costType,
            unit: dto.unit,
            rate: new Prisma.Decimal(dto.rate),
            currencyCode: dto.currencyCode ?? 'USD',
            effectiveFrom: new Date(dto.effectiveFrom),
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            status: 'ACTIVE',
            createdById: userId,
            updatedById: userId,
            ...links,
          },
          include: OPERATIONAL_COST_RATE_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'RATE_CREATE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, rate.id, ctx, {
          code: rate.code,
          costType: rate.costType,
          unit: rate.unit,
          rate: rate.rate.toString(),
        });
        return rate;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw this.conflict('productionCostRate.codeExists');
        }
        throw e;
      }
    });
  }

  async findRates(query: CostRateQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.costType) where.costType = query.costType;
    if (query.status) where.status = query.status;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { nameEn: { contains: query.search } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostRate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: OPERATIONAL_COST_RATE_INCLUDE,
      }),
      (this.prisma as any).operationalCostRate.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneRate(id: string, ctx: ActiveOperationalContext) {
    const rate = await (this.prisma as any).operationalCostRate.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: OPERATIONAL_COST_RATE_INCLUDE,
    });
    if (!rate) throw this.notFound('productionCostRate.notFound');
    return rate;
  }

  async updateRate(id: string, dto: UpdateCostRateDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const rate = await tx.operationalCostRate.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!rate) throw this.notFound('productionCostRate.notFound');
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostRate');
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : rate.effectiveFrom;
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : rate.effectiveTo;
      if (effectiveTo && effectiveTo < effectiveFrom) throw this.badRequest('productionCostRate.invalidEffectiveRange');

      const updated = await tx.operationalCostRate.update({
        where: { id },
        data: {
          nameAr: dto.nameAr ?? rate.nameAr,
          nameEn: dto.nameEn ?? rate.nameEn,
          description: dto.description !== undefined ? dto.description : rate.description,
          costType: dto.costType ?? rate.costType,
          unit: dto.unit ?? rate.unit,
          rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : rate.rate,
          currencyCode: dto.currencyCode ?? rate.currencyCode,
          effectiveFrom,
          effectiveTo,
          status: dto.status ?? rate.status,
          updatedById: userId,
          ...links,
        },
        include: OPERATIONAL_COST_RATE_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'RATE_UPDATE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, id, ctx, {
        code: rate.code,
        status: updated.status,
      });
      return updated;
    });
  }

  async deleteRate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const rate = await tx.operationalCostRate.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!rate) throw this.notFound('productionCostRate.notFound');
      const deleted = await tx.operationalCostRate.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE', updatedById: userId },
      });
      await this.writeAudit(tx, userId, 'RATE_DELETE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, id, ctx, { code: rate.code });
      return deleted;
    });
  }

  // ── Standard-cost snapshots ─────────────────────────────────────────────────

  async createSnapshot(dto: CreateCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.productionProductDefinition.findFirst({
        where: { id: dto.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!definition) throw this.notFound('productionCostSnapshot.productDefinitionNotFound');
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostSnapshot');
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw this.badRequest('productionCostSnapshot.invalidEffectiveRange');
      }
      const version = dto.productionVersionId ? await this.assertTenantScoped(tx, 'productionVersion', dto.productionVersionId, ctx, 'productionCostSnapshot.versionNotFound') : null;
      const packaging = dto.productionPackagingId ? await this.assertTenantScoped(tx, 'productionPackaging', dto.productionPackagingId, ctx, 'productionCostSnapshot.packagingNotFound') : null;
      if (version) links.productionVersionId = version.id;
      if (packaging) links.productionPackagingId = packaging.id;

      const max = await tx.operationalStandardCostSnapshot.aggregate({
        _max: { revision: true },
        where: { companyId: ctx.companyId, branchId: ctx.branchId, code: dto.code },
      });
      const revision = (max._max.revision ?? 0) + 1;
      const amount = new Prisma.Decimal(dto.quantity).mul(new Prisma.Decimal(dto.rate));

      try {
        const snapshot = await tx.operationalStandardCostSnapshot.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            code: dto.code,
            revision,
            productionProductDefinitionId: definition.id,
            costType: dto.costType,
            unit: dto.unit,
            quantity: new Prisma.Decimal(dto.quantity),
            rate: new Prisma.Decimal(dto.rate),
            amount,
            currencyCode: dto.currencyCode ?? 'USD',
            effectiveFrom: new Date(dto.effectiveFrom),
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            status: 'DRAFT',
            notes: dto.notes ?? null,
            createdById: userId,
            ...links,
          },
          include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'SNAPSHOT_CREATE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, snapshot.id, ctx, {
          code: snapshot.code,
          revision: snapshot.revision,
          costType: snapshot.costType,
          amount: snapshot.amount.toString(),
        });
        return snapshot;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw this.conflict('productionCostSnapshot.revisionConflict');
        }
        throw e;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findSnapshots(query: CostSnapshotQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.costType) where.costType = query.costType;
    if (query.status) where.status = query.status;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { revision: { equals: Number(query.search) } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalStandardCostSnapshot.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      }),
      (this.prisma as any).operationalStandardCostSnapshot.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneSnapshot(id: string, ctx: ActiveOperationalContext) {
    const snapshot = await (this.prisma as any).operationalStandardCostSnapshot.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
    });
    if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
    return snapshot;
  }

  async updateSnapshot(id: string, dto: UpdateCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.updateOnlyDraft');

      const quantity = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : snapshot.quantity;
      const rate = dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : snapshot.rate;
      const amount = quantity.mul(rate);
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : snapshot.effectiveFrom;
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : snapshot.effectiveTo;
      if (effectiveTo && effectiveTo < effectiveFrom) throw this.badRequest('productionCostSnapshot.invalidEffectiveRange');

      const updated = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          unit: dto.unit ?? snapshot.unit,
          quantity,
          rate,
          amount,
          currencyCode: dto.currencyCode ?? snapshot.currencyCode,
          effectiveFrom,
          effectiveTo,
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_UPDATE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
        amount: updated.amount.toString(),
      });
      return updated;
    });
  }

  async freezeSnapshot(id: string, dto: FreezeCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.freezeOnlyDraft');
      const frozen = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          status: 'FROZEN',
          frozenById: userId,
          frozenAt: new Date(),
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_FREEZE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return frozen;
    });
  }

  async supersedeSnapshot(id: string, dto: SupersedeCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'FROZEN') throw this.badRequest('productionCostSnapshot.supersedeOnlyFrozen');
      const superseded = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          status: 'SUPERSEDED',
          supersededById: userId,
          supersededAt: new Date(),
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_SUPERSEDE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return superseded;
    });
  }

  async deleteSnapshot(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.deleteOnlyDraft');
      const deleted = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_DELETE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return deleted;
    });
  }

  // ── Cost transactions ───────────────────────────────────────────────────────

  private async resolveTransactionRefs(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
  ): Promise<{ refs: Record<string, any>; snapshots: Record<string, any> }> {
    const refs: Record<string, any> = {};
    if (dto.productionOrderId) refs.productionOrderId = (await this.assertTenantScoped(tx, 'productionOrder', dto.productionOrderId, ctx, 'productionCostTransaction.orderNotFound')).id;
    if (dto.productionRunId) refs.productionRunId = (await this.assertTenantScoped(tx, 'productionRun', dto.productionRunId, ctx, 'productionCostTransaction.runNotFound')).id;
    if (dto.productId) refs.productId = (await this.assertTenantScoped(tx, 'product', dto.productId, ctx, 'productionCostTransaction.productNotFound')).id;
    if (dto.productionVersionId) refs.productionVersionId = (await this.assertTenantScoped(tx, 'productionVersion', dto.productionVersionId, ctx, 'productionCostTransaction.versionNotFound')).id;
    if (dto.productionPackagingId) refs.productionPackagingId = (await this.assertTenantScoped(tx, 'productionPackaging', dto.productionPackagingId, ctx, 'productionCostTransaction.packagingNotFound')).id;
    if (dto.productionLineId) refs.productionLineId = (await this.assertTenantScoped(tx, 'productionLine', dto.productionLineId, ctx, 'productionCostTransaction.lineNotFound')).id;
    if (dto.machineId) refs.machineId = (await this.assertTenantScoped(tx, 'machine', dto.machineId, ctx, 'productionCostTransaction.machineNotFound')).id;
    if (dto.shiftId) refs.shiftId = (await this.assertTenantScoped(tx, 'productionShift', dto.shiftId, ctx, 'productionCostTransaction.shiftNotFound')).id;
    if (dto.costCenterId) refs.costCenterId = (await this.assertTenantScoped(tx, 'costCenter', dto.costCenterId, ctx, 'productionCostTransaction.costCenterNotFound')).id;
    if (dto.outputEventId) refs.outputEventId = (await this.assertTenantScoped(tx, 'productionOutputEvent', dto.outputEventId, ctx, 'productionCostTransaction.outputEventNotFound')).id;

    if (refs.productionOrderId && refs.productionRunId) {
      const run = await tx.productionRun.findUnique({ where: { id: refs.productionRunId }, select: { productionOrderId: true } });
      if (run && run.productionOrderId !== refs.productionOrderId) {
        throw this.badRequest('productionCostTransaction.orderContextMismatch');
      }
    }

    const snapshots: Record<string, any> = {};
    if (dto.standardCostSnapshotId) {
      const snapshot = await this.assertTenantScoped(tx, 'operationalStandardCostSnapshot', dto.standardCostSnapshotId, ctx, 'productionCostTransaction.snapshotNotFound');
      if (snapshot.status !== 'FROZEN') throw this.badRequest('productionCostTransaction.snapshotNotFrozen');
      snapshots.standardCostSnapshot = snapshot;
    }
    return { refs, snapshots };
  }

  private async findBestStandardSnapshot(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
    refs: Record<string, any>,
    occurredAt: Date,
  ) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      status: 'FROZEN',
      effectiveFrom: { lte: occurredAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: occurredAt } }],
    };
    if (refs.productionVersionId) where.productionVersionId = refs.productionVersionId;
    if (refs.productionPackagingId) where.productionPackagingId = refs.productionPackagingId;
    if (refs.productionLineId) where.productionLineId = refs.productionLineId;
    if (refs.machineId) where.machineId = refs.machineId;
    if (refs.costCenterId) where.costCenterId = refs.costCenterId;

    const matches: any[] = [];
    if (refs.productionOrderId) {
      const order = await tx.productionOrder.findUnique({
        where: { id: refs.productionOrderId },
        select: { productionProductDefinitionId: true },
      });
      if (order) {
        const candidates = await tx.operationalStandardCostSnapshot.findMany({
          where: { ...where, productionProductDefinitionId: order.productionProductDefinitionId },
          orderBy: [{ revision: 'desc' }],
        });
        matches.push(...candidates);
      }
    }
    if (matches.length === 0 && refs.productId) {
      const candidates = await tx.operationalStandardCostSnapshot.findMany({
        where: { ...where, productionProductDefinition: { productId: refs.productId } },
        orderBy: [{ revision: 'desc' }],
      });
      matches.push(...candidates);
    }
    return matches[0] ?? null;
  }

  async postTransaction(dto: PostCostTransactionDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const raced = await tx.operationalCostTransaction.findFirst({
            where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
          });
          if (raced) return raced;

          const { refs, snapshots } = await this.resolveTransactionRefs(tx, dto, ctx);
          const occurredAt = new Date(dto.occurredAt);
          let standardSnapshot = snapshots.standardCostSnapshot ?? null;
          if (!standardSnapshot) {
            standardSnapshot = await this.findBestStandardSnapshot(tx, dto, ctx, refs, occurredAt);
          }

          const quantity = new Prisma.Decimal(dto.quantity);
          const rate = new Prisma.Decimal(dto.rate);
          const amount = quantity.mul(rate);
          let standardAmount: Prisma.Decimal | null = null;
          let varianceAmount: Prisma.Decimal | null = null;
          if (standardSnapshot) {
            standardAmount = quantity.mul(standardSnapshot.rate);
            varianceAmount = amount.sub(standardAmount);
          }

          let productCodeSnapshot: string | null = dto.productCodeSnapshot ?? null;
          let productNameSnapshot: string | null = dto.productNameSnapshot ?? null;
          if (refs.productId && !productCodeSnapshot) {
            const product = await tx.product.findUnique({ where: { id: refs.productId }, select: { code: true, name: true } });
            productCodeSnapshot = product?.code ?? null;
            productNameSnapshot = product?.name ?? null;
          }

          const transaction = await tx.operationalCostTransaction.create({
            data: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              eventType: dto.eventType,
              sourceType: dto.sourceType,
              sourceId: dto.sourceId,
              sourceNumberSnapshot: dto.sourceNumberSnapshot ?? null,
              clientRequestId: dto.clientRequestId,
              productCodeSnapshot,
              productNameSnapshot,
              quantity,
              unit: dto.unit,
              rate,
              amount,
              currencyCode: dto.currencyCode ?? 'USD',
              standardAmount,
              varianceAmount,
              occurredAt,
              status: 'POSTED',
              notes: dto.notes ?? null,
              createdById: userId,
              ...refs,
              ...(standardSnapshot ? { standardCostSnapshotId: standardSnapshot.id } : {}),
            },
            include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
          });
          await this.writeAudit(tx, userId, 'TRANSACTION_POST', OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY, transaction.id, ctx, {
            eventType: transaction.eventType,
            sourceType: transaction.sourceType,
            sourceId: transaction.sourceId,
            amount: transaction.amount.toString(),
            varianceAmount: transaction.varianceAmount ? transaction.varianceAmount.toString() : null,
          });
          return transaction;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.conflict('productionCostTransaction.duplicateRequest');
      }
      throw e;
    }
  }

  async findTransactions(query: CostTransactionQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.eventType) where.eventType = query.eventType;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }],
        include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
      }),
      (this.prisma as any).operationalCostTransaction.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneTransaction(id: string, ctx: ActiveOperationalContext) {
    const transaction = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
    });
    if (!transaction) throw this.notFound('productionCostTransaction.notFound');
    return transaction;
  }

  async reverseTransaction(id: string, dto: ReverseCostTransactionDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const raced = await tx.operationalCostTransaction.findFirst({
            where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
          });
          if (raced) return raced;

          const original = await tx.operationalCostTransaction.findFirst({
            where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
          });
          if (!original) throw this.notFound('productionCostTransaction.notFound');
          if (original.status !== 'POSTED' || original.reversalOfId) {
            throw this.badRequest('productionCostTransaction.reversableOnlyPosted');
          }
          if (original.reversedAt) throw this.badRequest('productionCostTransaction.alreadyReversed');

          const reversal = await tx.operationalCostTransaction.create({
            data: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              eventType: original.eventType,
              sourceType: 'REVERSAL',
              sourceId: original.id,
              sourceNumberSnapshot: original.sourceNumberSnapshot,
              clientRequestId: dto.clientRequestId,
              productionOrderId: original.productionOrderId,
              productionRunId: original.productionRunId,
              productId: original.productId,
              productCodeSnapshot: original.productCodeSnapshot,
              productNameSnapshot: original.productNameSnapshot,
              productionVersionId: original.productionVersionId,
              productionPackagingId: original.productionPackagingId,
              productionLineId: original.productionLineId,
              machineId: original.machineId,
              shiftId: original.shiftId,
              costCenterId: original.costCenterId,
              standardCostSnapshotId: original.standardCostSnapshotId,
              outputEventId: original.outputEventId,
              quantity: original.quantity.negated(),
              unit: original.unit,
              rate: original.rate,
              amount: original.amount.negated(),
              currencyCode: original.currencyCode,
              standardAmount: original.standardAmount ? original.standardAmount.negated() : null,
              varianceAmount: original.varianceAmount ? original.varianceAmount.negated() : null,
              occurredAt: new Date(),
              status: 'REVERSED',
              reversalOfId: original.id,
              reversalReason: dto.reason,
              notes: dto.notes ?? original.notes,
              createdById: userId,
            },
            include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
          });

          const updatedOriginal = await tx.operationalCostTransaction.update({
            where: { id: original.id },
            data: { reversedById: userId, reversedAt: new Date() },
          });

          await this.writeAudit(tx, userId, 'TRANSACTION_REVERSE', OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY, original.id, ctx, {
            reversalId: reversal.id,
            clientRequestId: dto.clientRequestId,
            reversedAmount: reversal.amount.toString(),
            reason: dto.reason,
          });
          return { original: updatedOriginal, reversal };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.conflict('productionCostTransaction.duplicateRequest');
      }
      throw e;
    }
  }
}
