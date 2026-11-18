import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import {
  SPARE_PART_ISSUE_AUDIT_ENTITY,
  SPARE_PART_ISSUE_INCLUDE,
  SPARE_PART_ISSUE_MOVEMENT_TYPE,
  SPARE_PART_ISSUE_SOURCE_TYPE,
} from './spare-part-issues.constants';
import {
  CancelSparePartIssueApprovalDto,
  CancelSparePartIssueDto,
  CreateSparePartIssueDto,
  CreateSparePartIssueLineDto,
  RejectSparePartIssueDto,
  SparePartIssueQueryDto,
  UpdateSparePartIssueDto,
  WithdrawSparePartIssueDto,
} from './dto/spare-part-issue.dto';

type ResolvedLine = CreateSparePartIssueLineDto & {
  /** Canonical productId resolved from SparePart.productId — never from the client. */
  canonicalProductId: string;
  sparePartCode: string;
  sparePartName: string;
  productCode: string;
  productName: string;
};

/**
 * Standalone spare-part issue voucher authority.
 *
 * Design invariants:
 * - No MaintenanceRequest / ProductionOrder is fabricated or required.
 * - The SparePart master (ACTIVE, not deleted) and its linked Product
 *   (ACTIVE, not deleted) are the only classification authorities.
 * - A DRAFT issue creates a DRAFT OUT InventoryMovement but NO balance queries
 *   and NO balance writes; sufficiency is owned by the posting authority.
 * - Posting delegates exclusively to InventoryMovementsService.postMovementWithinTransaction
 *   inside a serializable transaction. This service never writes InventoryBalance.
 */
@Injectable()
export class SparePartIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberingService: NumberingService,
    private readonly movementsService: InventoryMovementsService,
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

  private forbidden(key: string): ForbiddenException {
    return new ForbiddenException({ messageKey: key, message: key });
  }

  private writeAudit(
    client: any,
    userId: string,
    action: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    details: Record<string, any>,
  ) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity: SPARE_PART_ISSUE_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async findIssue(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const issue = await client.sparePartIssue.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: SPARE_PART_ISSUE_INCLUDE,
    });
    if (!issue) throw this.notFound('sparePartIssue.notFound');
    return issue;
  }

  private findIssueByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.sparePartIssue.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: SPARE_PART_ISSUE_INCLUDE,
    });
  }

  /**
   * Resolves every tenant/branch/classification/identity rule on the same
   * transaction client that will perform the mutation. No balance lookup is
   * performed here: a zero-balance DRAFT is explicitly allowed.
   */
  private async resolveContext(
    dto: { issueWarehouseId: string; lines: CreateSparePartIssueLineDto[] },
    ctx: ActiveOperationalContext,
    client: any,
  ): Promise<{ warehouse: any; resolvedLines: ResolvedLine[] }> {
    const warehouse = await client.warehouse.findUnique({ where: { id: dto.issueWarehouseId } });
    if (!warehouse) throw this.notFound('sparePartIssue.warehouseNotFound');
    if (warehouse.companyId !== ctx.companyId) throw this.badRequest('sparePartIssue.warehouseTenantMismatch');
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.badRequest('sparePartIssue.warehouseBranchMismatch');
    }
    // A PRODUCT / RAW_MATERIAL warehouse cannot be used as a spare-part issue
    // source (same classification authority as the unified issue-voucher lookups).
    if (['PRODUCT', 'RAW_MATERIAL'].includes(warehouse.warehouseType ?? '')) {
      throw this.badRequest('inventory.issueVoucher.invalidSelection');
    }

    const seen = new Set<string>();
    for (const line of dto.lines) {
      const identity = [
        line.sparePartId,
        line.warehouseLocationId ?? '',
        line.batchNumber ?? '',
        line.serialNumber ?? '',
      ].join('|');
      if (seen.has(identity)) throw this.badRequest('inventory.issueVoucher.invalidSelection');
      seen.add(identity);
    }

    const sparePartIds = [...new Set(dto.lines.map((line) => line.sparePartId))];
    const spareParts = await client.sparePart.findMany({
      where: { id: { in: sparePartIds }, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        productId: true,
        product: { select: { id: true, code: true, name: true, status: true, deletedAt: true } },
      },
    });
    const sparePartById = new Map(spareParts.map((sparePart: any) => [sparePart.id, sparePart]));

    const resolvedLines: ResolvedLine[] = dto.lines.map((line) => {
      const sparePart: any = sparePartById.get(line.sparePartId);
      if (!sparePart) throw this.notFound('sparePartIssue.sparePartNotFound');
      const product = sparePart.product;
      if (!product || !product.id || product.status !== 'ACTIVE' || product.deletedAt) {
        throw this.notFound('sparePartIssue.productNotFound');
      }
      // A client-supplied productId is only an assertion. It can never redirect
      // the movement to a different (possibly foreign-classification) product.
      if (line.productId && line.productId !== product.id) {
        throw this.badRequest('inventory.issueVoucher.invalidSelection');
      }
      return {
        ...line,
        canonicalProductId: product.id,
        sparePartCode: sparePart.code ?? '',
        sparePartName: sparePart.name ?? '',
        productCode: product.code ?? '',
        productName: product.name ?? '',
      };
    });

    for (const line of dto.lines) {
      if (!line.warehouseLocationId) continue;
      const location = await client.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
      if (!location) throw this.notFound('sparePartIssue.locationNotFound');
      if (location.warehouseId !== warehouse.id) {
        throw this.badRequest('sparePartIssue.locationWarehouseMismatch');
      }
    }

    return { warehouse, resolvedLines };
  }

  private toMovementLines(lines: ResolvedLine[]) {
    return lines.map((line) => ({
      productId: line.canonicalProductId,
      quantity: line.quantity,
      warehouseLocationId: line.warehouseLocationId ?? null,
      batchNumber: line.batchNumber ?? null,
      serialNumber: line.serialNumber ?? null,
      expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
      unit: line.unit,
      productUomId: line.productUomId ?? null,
      enteredUnitId: line.enteredUnitId ?? null,
      direction: 'OUT',
      notes: line.notes ?? null,
    }));
  }

  private lineCreateData(line: ResolvedLine, index: number, ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      sparePartId: line.sparePartId,
      productId: line.canonicalProductId,
      sparePartCodeSnapshot: line.sparePartCode,
      sparePartNameSnapshot: line.sparePartName,
      productCodeSnapshot: line.productCode,
      productNameSnapshot: line.productName,
      unit: line.unit,
      quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
      productUomId: line.productUomId ?? null,
      warehouseLocationId: line.warehouseLocationId ?? null,
      batchNumber: line.batchNumber ?? null,
      serialNumber: line.serialNumber ?? null,
      expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
      lineNumber: index + 1,
      notes: line.notes ?? null,
    };
  }

  private async createIssueWithMovement(
    client: any,
    ctx: ActiveOperationalContext,
    userId: string,
    warehouse: any,
    dto: { issueDate?: string; notes?: string; purpose?: string; requestId?: string },
    resolvedLines: ResolvedLine[],
  ) {
    const issueNumber = await this.numberingService.generateNumberAtomicWithClient('SPARE_PART_ISSUE', client);
    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', client);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

    // The single UOM/base-quantity conversion authority owns the movement lines.
    const movementLines = await this.movementsService.resolveMovementLines(client, this.toMovementLines(resolvedLines));
    const movement = await client.inventoryMovement.create({
      data: {
        movementNumber,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: warehouse.id,
        movementType: SPARE_PART_ISSUE_MOVEMENT_TYPE,
        status: 'DRAFT',
        sourceType: SPARE_PART_ISSUE_SOURCE_TYPE,
        sourceId: null,
        movementDate: issueDate,
        notes: dto.notes ?? null,
        createdById: userId,
        lines: { create: movementLines },
      },
    });

    return client.sparePartIssue.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        issueNumber,
        issueWarehouseId: warehouse.id,
        purpose: dto.purpose ?? null,
        status: 'DRAFT',
        movementId: movement.id,
        movementNumber: movement.movementNumber,
        sourceType: 'MANUAL',
        requestId: dto.requestId ?? null,
        notes: dto.notes ?? null,
        issueDate,
        createdById: userId,
        lines: { create: resolvedLines.map((line, index) => this.lineCreateData(line, index, ctx)) },
      },
      include: SPARE_PART_ISSUE_INCLUDE,
    });
  }

  async create(dto: CreateSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findIssueByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const { warehouse, resolvedLines } = await this.resolveContext(dto, ctx, tx);
        const issue = await this.createIssueWithMovement(tx, ctx, userId, warehouse, dto, resolvedLines);

        await this.writeAudit(tx, userId, 'CREATE', issue.id, ctx, {
          issueNumber: issue.issueNumber,
          movementId: issue.movementId,
          movementNumber: issue.movementNumber,
          lineCount: resolvedLines.length,
        });
        return issue;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx) : null;
        if (raced) return raced;
        throw this.conflict('sparePartIssue.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: SparePartIssueQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.warehouseId) where.issueWarehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.requestId) where.requestId = query.requestId;
    if (query.dateFrom || query.dateTo) {
      where.issueDate = {};
      if (query.dateFrom) where.issueDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.issueDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { issueNumber: { contains: query.search } },
        { movementNumber: { contains: query.search } },
        { purpose: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      (this.prisma as any).sparePartIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ issueDate: 'desc' }],
        include: SPARE_PART_ISSUE_INCLUDE,
      }),
      (this.prisma as any).sparePartIssue.count({ where }),
    ]);
    const data = await this.withActorNamesMany(rows);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    return this.withActorNames(issue);
  }

  private actorIds(records: any[]): string[] {
    const fields = [
      'createdById',
      'submittedById',
      'approvedById',
      'rejectedById',
      'withdrawnById',
      'approvalCancelledById',
      'postedById',
      'cancelledById',
    ];
    return [...new Set(records.flatMap((record) => fields
      .map((field) => record[field])
      .filter((id): id is string => typeof id === 'string' && id.length > 0)))];
  }

  /** Single user lookup for a page so no N+1 actor-name queries are issued. */
  private async withActorNamesMany<T extends Record<string, any>>(records: T[], client: any = this.prisma) {
    const ids = this.actorIds(records);
    if (ids.length === 0) return records.map((record) => ({ ...record, actorNames: {} }));
    const users = await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const names: Record<string, string> = Object.fromEntries(users.map((user: any) => [user.id, user.name]));
    return records.map((record) => ({
      ...record,
      actorNames: Object.fromEntries(this.actorIds([record]).map((id) => [id, names[id] ?? id])),
    }));
  }

  private async withActorNames<T extends Record<string, any>>(record: T, client: any = this.prisma) {
    const [decorated] = await this.withActorNamesMany([record], client);
    return decorated;
  }

  async update(id: string, dto: UpdateSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (issue.status !== 'DRAFT') throw this.badRequest('sparePartIssue.notDraft');

      if (dto.lines && dto.lines.length > 0) {
        if (!issue.movementId) throw this.badRequest('sparePartIssue.movementMissing');
        const movementId: string = issue.movementId;
        // The warehouse is always taken from the persisted DRAFT, never from the
        // client, so a manipulated draft update cannot redirect stock.
        const { warehouse, resolvedLines } = await this.resolveContext(
          { issueWarehouseId: issue.issueWarehouseId, lines: dto.lines },
          ctx,
          tx,
        );

        await tx.sparePartIssueLine.deleteMany({ where: { issueId: id } });
        await tx.sparePartIssueLine.createMany({
          data: resolvedLines.map((line, index) => ({
            issueId: id,
            ...this.lineCreateData(line, index, ctx),
          })),
        });
        await tx.inventoryMovementLine.deleteMany({ where: { movementId } });
        const rebuiltMovementLines = await this.movementsService.resolveMovementLines(tx, this.toMovementLines(resolvedLines));
        await tx.inventoryMovementLine.createMany({
          data: rebuiltMovementLines.map((line) => ({ ...line, movementId })),
        });
        // Keep the movement's warehouse consistent with the persisted header.
        await tx.inventoryMovement.update({
          where: { id: movementId },
          data: { warehouseId: warehouse.id },
        });
      }

      const updated = await tx.sparePartIssue.update({
        where: { id },
        data: {
          notes: dto.notes ?? issue.notes,
          purpose: dto.purpose ?? issue.purpose,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : issue.issueDate,
        },
        include: SPARE_PART_ISSUE_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'UPDATE', id, ctx, { issueNumber: issue.issueNumber });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Guarded claim: two concurrent decisions can never both succeed. */
  private async transitionStatus(
    id: string,
    ctx: ActiveOperationalContext,
    userId: string,
    action: string,
    fromStatuses: string[],
    data: Record<string, any>,
    auditDetails: Record<string, any> = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (!fromStatuses.includes(issue.status)) throw this.badRequest('sparePartIssue.invalidTransition');

      const claim = await tx.sparePartIssue.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: { in: fromStatuses } },
        data,
      });
      if (claim.count !== 1) throw this.conflict('sparePartIssue.invalidTransition');

      const updated = await tx.sparePartIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: SPARE_PART_ISSUE_INCLUDE,
      });
      if (!updated) throw this.notFound('sparePartIssue.notFound');

      await this.writeAudit(tx, userId, action, id, ctx, {
        issueNumber: issue.issueNumber,
        oldStatus: issue.status,
        newStatus: data.status,
        ...auditDetails,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'DRAFT') throw this.badRequest('sparePartIssue.notDraft');
    return this.transitionStatus(
      id,
      ctx,
      userId,
      'SUBMIT',
      ['DRAFT'],
      { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
      { requesterId: userId },
    );
  }

  async withdraw(id: string, dto: WithdrawSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('sparePartIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById !== userId) {
      throw this.forbidden('sparePartIssue.onlyRequesterCanWithdraw');
    }
    return this.transitionStatus(
      id,
      ctx,
      userId,
      'WITHDRAW',
      ['SUBMITTED'],
      {
        status: 'DRAFT',
        withdrawnAt: new Date(),
        withdrawnById: userId,
        submittedAt: null,
        submittedById: null,
      },
      { reason: dto.reason ?? null },
    );
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('sparePartIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('sparePartIssue.cannotApproveOwnRequest');
    }
    return this.transitionStatus(
      id,
      ctx,
      userId,
      'APPROVE',
      ['SUBMITTED'],
      { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
      { requesterId: issue.submittedById ?? null },
    );
  }

  async reject(id: string, dto: RejectSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('sparePartIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('sparePartIssue.cannotApproveOwnRequest');
    }
    return this.transitionStatus(
      id,
      ctx,
      userId,
      'REJECT',
      ['SUBMITTED'],
      { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId, rejectionReason: dto.reason },
      { requesterId: issue.submittedById ?? null, reason: dto.reason },
    );
  }

  async cancelApproval(
    id: string,
    dto: CancelSparePartIssueApprovalDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'APPROVED') throw this.badRequest('sparePartIssue.notApproved');
    return this.transitionStatus(
      id,
      ctx,
      userId,
      'CANCEL_APPROVAL',
      ['APPROVED'],
      {
        status: 'SUBMITTED',
        approvalCancelledAt: new Date(),
        approvalCancelledById: userId,
        approvalCancellationReason: dto.reason,
      },
      { reason: dto.reason, previousApprovedById: issue.approvedById ?? null },
    );
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.withTransientTransactionRetry(() => this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (issue.status !== 'APPROVED') throw this.badRequest('sparePartIssue.notApproved');
      if (!issue.movementId) throw this.badRequest('sparePartIssue.movementMissing');

      // The ONLY physical stock posting authority. Any failure here (or in the
      // status update below) aborts the transaction: the voucher stays APPROVED
      // and no partial success is reported to the caller.
      await this.movementsService.postMovementWithinTransaction(tx, issue.movementId, userId, ctx);

      const posted = await tx.sparePartIssue.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
        include: SPARE_PART_ISSUE_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'POST', id, ctx, {
        issueNumber: issue.issueNumber,
        movementId: issue.movementId,
        movementNumber: issue.movementNumber,
      });
      return posted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async withTransientTransactionRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isTransient = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isTransient || attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      }
    }
    throw new Error('withTransientTransactionRetry exhausted attempts');
  }

  async cancel(id: string, dto: CancelSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (!['DRAFT', 'SUBMITTED', 'REJECTED'].includes(issue.status)) {
        throw this.badRequest('sparePartIssue.invalidTransition');
      }

      if (issue.movementId) {
        const movement = await tx.inventoryMovement.findUnique({ where: { id: issue.movementId } });
        if (!movement) throw this.notFound('sparePartIssue.movementMissing');
        if (movement.status === 'DRAFT') {
          await tx.inventoryMovement.update({
            where: { id: issue.movementId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
          });
        }
      }

      const claim = await tx.sparePartIssue.updateMany({
        where: {
          id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, notes: dto.reason },
      });
      if (claim.count !== 1) throw this.conflict('sparePartIssue.invalidTransition');

      const cancelled = await tx.sparePartIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: SPARE_PART_ISSUE_INCLUDE,
      });
      if (!cancelled) throw this.notFound('sparePartIssue.notFound');

      await this.writeAudit(tx, userId, 'CANCEL', id, ctx, {
        issueNumber: issue.issueNumber,
        oldStatus: issue.status,
        newStatus: 'CANCELLED',
        reason: dto.reason,
      });
      return cancelled;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
