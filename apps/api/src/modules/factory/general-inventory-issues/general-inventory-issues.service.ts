import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import {
  GENERAL_INVENTORY_ISSUE_AUDIT_ENTITY,
  GENERAL_INVENTORY_ISSUE_INCLUDE,
  GENERAL_INVENTORY_ISSUE_MOVEMENT_TYPE,
  GENERAL_INVENTORY_ISSUE_REVERSAL_MOVEMENT_TYPE,
  GENERAL_INVENTORY_ISSUE_SOURCE_TYPE,
} from './general-inventory-issues.constants';
import {
  CancelGeneralInventoryIssueApprovalDto,
  CancelGeneralInventoryIssueDto,
  CreateGeneralInventoryIssueDto,
  CreateGeneralInventoryIssueLineDto,
  GeneralInventoryIssueQueryDto,
  RejectGeneralInventoryIssueDto,
  ReverseGeneralInventoryIssueDto,
  UpdateGeneralInventoryIssueDto,
  WithdrawGeneralInventoryIssueDto,
} from './dto/general-inventory-issue.dto';

type ResolvedLine = CreateGeneralInventoryIssueLineDto & {
  productCode: string;
  productName: string;
};

type IssueType = 'PACKAGING_MATERIAL' | 'CONSUMABLE' | 'GENERAL';

/**
 * Canonical general inventory OUT voucher authority.
 *
 * Design invariants:
 * - Only Product rows classified PACKAGING_MATERIAL, CONSUMABLE or GENERAL are
 *   accepted; null/unclassified and mismatched item types are rejected.
 * - No generic issue persistence model for the unified UI is created here; this
 *   is the native authority for exactly those three issue types.
 * - A DRAFT issue creates a DRAFT OUT InventoryMovement but never queries or
 *   writes a balance. Sufficiency is owned by the posting authority.
 * - Posting delegates exclusively to
 *   InventoryMovementsService.postMovementWithinTransaction inside a
 *   serializable transaction. This service never writes InventoryBalance.
 * - Reversal creates a new DRAFT IN issue that must be separately approved and
 *   posted using this same authority.
 */
@Injectable()
export class GeneralInventoryIssuesService {
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

  private assertContext(ctx: ActiveOperationalContext): void {
    if (!ctx?.companyId || !ctx?.branchId) {
      throw this.badRequest('generalInventoryIssue.invalidContext');
    }
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
      entity: GENERAL_INVENTORY_ISSUE_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async findIssue(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const issue = await client.generalInventoryIssue.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: GENERAL_INVENTORY_ISSUE_INCLUDE,
    });
    if (!issue) throw this.notFound('generalInventoryIssue.notFound');
    return issue;
  }

  private findIssueByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.generalInventoryIssue.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: GENERAL_INVENTORY_ISSUE_INCLUDE,
    });
  }

  /**
   * Resolves every tenant/branch/classification/identity rule on the same
   * transaction client that will perform the mutation. No balance lookup is
   * performed here: a zero-stock DRAFT is explicitly allowed.
   */
  private async resolveContext(
    dto: { issueType: IssueType; issueWarehouseId: string; lines: CreateGeneralInventoryIssueLineDto[] },
    ctx: ActiveOperationalContext,
    client: any,
  ): Promise<{ warehouse: any; resolvedLines: ResolvedLine[] }> {
    this.assertContext(ctx);

    const warehouse = await client.warehouse.findFirst({
      where: {
        id: dto.issueWarehouseId,
        companyId: ctx.companyId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    });
    if (!warehouse) throw this.notFound('generalInventoryIssue.warehouseNotFound');
    if (warehouse.status !== 'ACTIVE' || warehouse.deletedAt) {
      throw this.badRequest('generalInventoryIssue.warehouseInactive');
    }

    const seen = new Set<string>();
    for (const line of dto.lines) {
      const identity = [
        line.productId,
        line.warehouseLocationId ?? '',
        line.batchNumber ?? '',
        line.serialNumber ?? '',
        line.expiryDate ?? '',
      ].join('|');
      if (seen.has(identity)) throw this.badRequest('generalInventoryIssue.duplicateLine');
      seen.add(identity);
    }

    const productIds = [...new Set(dto.lines.map((line) => line.productId))];
    const products = await client.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, name: true, itemType: true },
    });
    const productById = new Map(products.map((product: any) => [product.id, product]));

    const resolvedLines: ResolvedLine[] = dto.lines.map((line) => {
      const product: any = productById.get(line.productId);
      if (!product) throw this.notFound('generalInventoryIssue.productNotFound');
      // Null/unclassified and mismatched item types are both rejected here.
      if (product.itemType !== dto.issueType) {
        throw this.badRequest('generalInventoryIssue.productTypeMismatch');
      }
      return {
        ...line,
        productCode: product.code ?? '',
        productName: product.name ?? '',
      };
    });

    for (const line of dto.lines) {
      if (!line.warehouseLocationId) continue;
      const location = await client.warehouseLocation.findFirst({
        where: { id: line.warehouseLocationId, warehouseId: warehouse.id },
      });
      if (!location) throw this.notFound('generalInventoryIssue.locationNotFound');
      if (location.status !== 'ACTIVE') {
        throw this.badRequest('generalInventoryIssue.locationInactive');
      }
    }

    for (const line of dto.lines) {
      if (!line.productUomId) continue;
      const uom = await client.productUom.findFirst({
        where: { id: line.productUomId, productId: line.productId },
      });
      if (!uom) throw this.notFound('generalInventoryIssue.uomNotFound');
      if (!uom.isActive) {
        throw this.badRequest('generalInventoryIssue.invalidUom');
      }
    }

    return { warehouse, resolvedLines };
  }

  private lineToMovementLines(direction: 'IN' | 'OUT', lines: ResolvedLine[]) {
    return lines.map((line) => ({
      productId: line.productId,
      warehouseLocationId: line.warehouseLocationId ?? null,
      quantity: line.quantity,
      batchNumber: line.batchNumber ?? null,
      serialNumber: line.serialNumber ?? null,
      expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
      unit: line.unit,
      productUomId: line.productUomId ?? null,
      enteredUnitId: line.enteredUnitId ?? null,
      // Historical replay path (internal reversal only).
      quantityBase: line.historicalQuantityBase,
      direction,
      notes: line.notes ?? null,
    }));
  }

  private lineCreateData(line: ResolvedLine, index: number, ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      productId: line.productId,
      productCodeSnapshot: line.productCode,
      productNameSnapshot: line.productName,
      unit: line.unit,
      quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
      productUomId: line.productUomId ?? null,
      enteredUnitId: line.enteredUnitId ?? null,
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
    dto: {
      issueType: IssueType;
      issueDate?: string;
      notes?: string;
      purpose?: string;
      requestId?: string;
      lines: ResolvedLine[];
    },
    direction: 'IN' | 'OUT',
    sourceIssueId: string | null,
  ) {
    const issueNumber = await this.numberingService.generateNumberAtomicWithClient('GENERAL_INVENTORY_ISSUE', client);
    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', client);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

    // The single UOM/base-quantity conversion authority owns the movement lines.
    const movementLines = await this.movementsService.resolveMovementLines(
      client,
      this.lineToMovementLines(direction, dto.lines),
    );
    const movement = await client.inventoryMovement.create({
      data: {
        movementNumber,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: warehouse.id,
        movementType: direction === 'IN' ? GENERAL_INVENTORY_ISSUE_REVERSAL_MOVEMENT_TYPE : GENERAL_INVENTORY_ISSUE_MOVEMENT_TYPE,
        status: 'DRAFT',
        sourceType: GENERAL_INVENTORY_ISSUE_SOURCE_TYPE,
        sourceId: sourceIssueId,
        movementDate: issueDate,
        notes: dto.notes ?? null,
        createdById: userId,
        lines: { create: movementLines },
      },
    });

    return client.generalInventoryIssue.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        issueNumber,
        issueType: dto.issueType,
        issueWarehouseId: warehouse.id,
        purpose: dto.purpose ?? null,
        status: 'DRAFT',
        movementId: movement.id,
        movementNumber: movement.movementNumber,
        sourceType: sourceIssueId ? 'REVERSE' : 'MANUAL',
        requestId: dto.requestId ?? null,
        notes: dto.notes ?? null,
        issueDate,
        createdById: userId,
        reversesIssueId: sourceIssueId,
        lines: { create: dto.lines.map((line, index) => this.lineCreateData(line, index, ctx)) },
      },
      include: GENERAL_INVENTORY_ISSUE_INCLUDE,
    });
  }

  async create(dto: CreateGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    if (dto.requestId) {
      const existing = await this.findIssueByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const { warehouse, resolvedLines } = await this.resolveContext(dto, ctx, tx);
        const issue = await this.createIssueWithMovement(
          tx,
          ctx,
          userId,
          warehouse,
          { ...dto, lines: resolvedLines },
          'OUT',
          null,
        );

        await this.writeAudit(tx, userId, 'CREATE', issue.id, ctx, {
          issueNumber: issue.issueNumber,
          issueType: issue.issueType,
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
        throw this.conflict('generalInventoryIssue.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: GeneralInventoryIssueQueryDto, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.warehouseId) where.issueWarehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.issueType) where.issueType = query.issueType;
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
      (this.prisma as any).generalInventoryIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ issueDate: 'desc' }],
        include: GENERAL_INVENTORY_ISSUE_INCLUDE,
      }),
      (this.prisma as any).generalInventoryIssue.count({ where }),
    ]);
    const data = await this.withActorNamesMany(rows);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
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

  async update(id: string, dto: UpdateGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (issue.status !== 'DRAFT') throw this.badRequest('generalInventoryIssue.notDraft');

      if (dto.lines && dto.lines.length > 0) {
        if (!issue.movementId) throw this.badRequest('generalInventoryIssue.movementMissing');
        const movementId: string = issue.movementId;
        // The warehouse and issue type always come from the persisted DRAFT,
        // never from the client, so a manipulated update cannot redirect stock.
        const { warehouse, resolvedLines } = await this.resolveContext(
          { issueType: issue.issueType, issueWarehouseId: issue.issueWarehouseId, lines: dto.lines },
          ctx,
          tx,
        );

        await tx.generalInventoryIssueLine.deleteMany({ where: { issueId: id } });
        await tx.generalInventoryIssueLine.createMany({
          data: resolvedLines.map((line, index) => ({
            issueId: id,
            ...this.lineCreateData(line, index, ctx),
          })),
        });
        await tx.inventoryMovementLine.deleteMany({ where: { movementId } });
        const rebuiltMovementLines = await this.movementsService.resolveMovementLines(
          tx,
          this.lineToMovementLines('OUT', resolvedLines),
        );
        await tx.inventoryMovementLine.createMany({
          data: rebuiltMovementLines.map((line) => ({ ...line, movementId })),
        });
        // Keep the movement's warehouse consistent with the persisted header.
        const movementClaim = await tx.inventoryMovement.updateMany({
          where: { id: movementId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'DRAFT' },
          data: { warehouseId: warehouse.id },
        });
        if (movementClaim.count !== 1) throw this.conflict('generalInventoryIssue.invalidTransition');
      }

      const updated = await tx.generalInventoryIssue.update({
        where: { id },
        data: {
          notes: dto.notes ?? issue.notes,
          purpose: dto.purpose ?? issue.purpose,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : issue.issueDate,
        },
        include: GENERAL_INVENTORY_ISSUE_INCLUDE,
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
      if (!fromStatuses.includes(issue.status)) throw this.badRequest('generalInventoryIssue.invalidTransition');

      const claim = await tx.generalInventoryIssue.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: { in: fromStatuses } },
        data,
      });
      if (claim.count !== 1) throw this.conflict('generalInventoryIssue.invalidTransition');

      const updated = await tx.generalInventoryIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: GENERAL_INVENTORY_ISSUE_INCLUDE,
      });
      if (!updated) throw this.notFound('generalInventoryIssue.notFound');

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
    this.assertContext(ctx);
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'DRAFT') throw this.badRequest('generalInventoryIssue.notDraft');
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

  async withdraw(id: string, dto: WithdrawGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('generalInventoryIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById !== userId) {
      throw this.forbidden('generalInventoryIssue.onlyRequesterCanWithdraw');
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
    this.assertContext(ctx);
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('generalInventoryIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('generalInventoryIssue.cannotApproveOwnRequest');
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

  async reject(id: string, dto: RejectGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    if (!dto.reason?.trim()) throw this.badRequest('generalInventoryIssue.reasonRequired');
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('generalInventoryIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('generalInventoryIssue.cannotApproveOwnRequest');
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
    dto: CancelGeneralInventoryIssueApprovalDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    this.assertContext(ctx);
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'APPROVED') throw this.badRequest('generalInventoryIssue.notApproved');
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
    this.assertContext(ctx);
    return this.withTransientTransactionRetry(() => this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (issue.status !== 'APPROVED') throw this.badRequest('generalInventoryIssue.notApproved');
      if (!issue.movementId) throw this.badRequest('generalInventoryIssue.movementMissing');

      // The ONLY physical stock posting authority. A reversal must use the
      // trusted original-cost entrypoint; a manual issue uses the canonical
      // valued issue path. Any failure here aborts the transaction.
      if (issue.sourceType === 'REVERSE' || issue.reversesIssueId) {
        await this.movementsService.postGeneralIssueReversalMovementWithinTransaction(
          tx,
          id,
          issue.movementId,
          userId,
          ctx,
        );
      } else {
        await this.movementsService.postMovementWithinTransaction(tx, issue.movementId, userId, ctx);
      }

      const claim = await tx.generalInventoryIssue.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: 'APPROVED' },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });
      if (claim.count !== 1) throw this.conflict('generalInventoryIssue.invalidTransition');

      const posted = await tx.generalInventoryIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: GENERAL_INVENTORY_ISSUE_INCLUDE,
      });
      if (!posted) throw this.notFound('generalInventoryIssue.notFound');

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

  async cancel(id: string, dto: CancelGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      // APPROVED/POSTED documents can only be corrected through
      // cancel-approval/reversal, never by the generic cancel endpoint.
      if (!['DRAFT', 'SUBMITTED', 'REJECTED'].includes(issue.status)) {
        throw this.badRequest('generalInventoryIssue.invalidTransition');
      }

      if (issue.movementId) {
        const movement = await tx.inventoryMovement.findFirst({
          where: {
            id: issue.movementId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
          },
        });
        if (!movement) throw this.notFound('generalInventoryIssue.movementMissing');
        if (movement.status === 'DRAFT') {
          const movementClaim = await tx.inventoryMovement.updateMany({
            where: {
              id: issue.movementId,
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              status: 'DRAFT',
            },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
          });
          if (movementClaim.count !== 1) throw this.conflict('generalInventoryIssue.invalidTransition');
        }
      }

      const claim = await tx.generalInventoryIssue.updateMany({
        where: {
          id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, notes: dto.reason },
      });
      if (claim.count !== 1) throw this.conflict('generalInventoryIssue.invalidTransition');

      const cancelled = await tx.generalInventoryIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: GENERAL_INVENTORY_ISSUE_INCLUDE,
      });
      if (!cancelled) throw this.notFound('generalInventoryIssue.notFound');

      await this.writeAudit(tx, userId, 'CANCEL', id, ctx, {
        issueNumber: issue.issueNumber,
        oldStatus: issue.status,
        newStatus: 'CANCELLED',
        reason: dto.reason,
      });
      return cancelled;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Reverses a POSTED issue by creating a new DRAFT IN issue whose linked DRAFT
   * movement carries the exact issued quantities. The original is never
   * mutated; a source can only be reversed once and a reversal cannot itself be
   * reversed. The reversal must be separately approved and posted.
   */
  async reverse(id: string, dto: ReverseGeneralInventoryIssueDto, userId: string, ctx: ActiveOperationalContext) {
    this.assertContext(ctx);
    if (dto.requestId) {
      const existing = await this.findIssueByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    return this.withTransientTransactionRetry(async () => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx, tx) : null;
          if (raced) return raced;

          const source = await this.findIssue(id, ctx, tx);
          if (source.status !== 'POSTED') throw this.badRequest('generalInventoryIssue.reverseOnlyPosted');
          if (source.sourceType === 'REVERSE' || source.reversesIssueId) {
            throw this.badRequest('generalInventoryIssue.cannotReverseReversal');
          }

          const existingReversal = await tx.generalInventoryIssue.findFirst({
            where: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              reversesIssueId: source.id,
              status: { not: 'CANCELLED' },
            },
            select: { id: true },
          });
          if (existingReversal) throw this.conflict('generalInventoryIssue.alreadyReversed');

          // Historical conversion replay: pair each source line with its immutable
          // InventoryMovementLine so the IN reversal replays the exact historical
          // base quantity (zero reversal drift).
          const sourceMovementLines: Array<{ productId: string; quantity: any; direction: string; quantityBase: any }> =
            source.movementId
              ? await tx.inventoryMovementLine.findMany({
                  where: { movementId: source.movementId, direction: 'OUT' },
                  select: { productId: true, quantity: true, direction: true, quantityBase: true },
                })
              : [];
          const usedMovementLines = new Set<number>();
          const takeMovementEvidence = (productId: string, quantity: Prisma.Decimal) => {
            for (let index = 0; index < sourceMovementLines.length; index++) {
              if (usedMovementLines.has(index)) continue;
              const candidate = sourceMovementLines[index];
              if (candidate.productId !== productId) continue;
              if (!new Prisma.Decimal(candidate.quantity).equals(quantity)) continue;
              usedMovementLines.add(index);
              return candidate;
            }
            return null;
          };
          const reverseLines: ResolvedLine[] = source.lines.map((line: any) => {
            const evidence = takeMovementEvidence(line.productId, new Prisma.Decimal(line.quantity));
            // UOM fields are intentionally omitted: the historical base quantity
            // from the OUT movement must be replayed verbatim. Supplying a UOM here
            // would make the conversion authority recalculate with today's factor
            // and could create reversal drift.
            const reversed: ResolvedLine = {
              productId: line.productId,
              quantity: Number(line.quantity),
              unit: line.unit,
              warehouseLocationId: line.warehouseLocationId ?? undefined,
              batchNumber: line.batchNumber ?? undefined,
              serialNumber: line.serialNumber ?? undefined,
              expiryDate: line.expiryDate ? line.expiryDate.toISOString() : undefined,
              productCode: line.productCodeSnapshot ?? '',
              productName: line.productNameSnapshot ?? '',
            };
            if (evidence?.quantityBase) reversed.historicalQuantityBase = Number(evidence.quantityBase);
            return reversed;
          });

          const warehouse = source.issueWarehouseId
            ? await tx.warehouse.findFirst({
                where: {
                  id: source.issueWarehouseId,
                  companyId: ctx.companyId,
                  OR: [{ branchId: ctx.branchId }, { branchId: null }],
                },
              })
            : null;
          if (!warehouse) throw this.notFound('generalInventoryIssue.warehouseNotFound');
          if (warehouse.status !== 'ACTIVE' || warehouse.deletedAt) {
            throw this.badRequest('generalInventoryIssue.warehouseInactive');
          }

          const reversal = await this.createIssueWithMovement(
            tx,
            ctx,
            userId,
            warehouse,
            {
              issueType: source.issueType,
              // The UI supplies a localized note; direct API callers may leave it empty.
              notes: dto.notes ?? undefined,
              lines: reverseLines,
              requestId: dto.requestId,
            },
            'IN',
            source.id,
          );

          await this.writeAudit(tx, userId, 'REVERSE', reversal.id, ctx, {
            issueNumber: reversal.issueNumber,
            reverseOf: source.issueNumber,
            movementId: reversal.movementId,
          });
          return reversal;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx) : null;
          if (raced) return raced;
          throw this.conflict('generalInventoryIssue.duplicateRequest');
        }
        throw error;
      }
    });
  }
}
