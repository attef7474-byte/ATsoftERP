import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import {
  FINISHED_GOODS_ISSUE_AUDIT_ENTITY,
  FINISHED_GOODS_ISSUE_INCLUDE,
  FINISHED_GOODS_ISSUE_MOVEMENT_TYPE,
  FINISHED_GOODS_ISSUE_REVERSAL_MOVEMENT_TYPE,
  FINISHED_GOODS_ISSUE_SOURCE_TYPE,
} from './finished-goods-issues.constants';
import {
  CancelFinishedGoodsIssueApprovalDto,
  CancelFinishedGoodsIssueDto,
  CreateFinishedGoodsIssueDto,
  CreateFinishedGoodsIssueLineDto,
  FinishedGoodsIssueQueryDto,
  RejectFinishedGoodsIssueDto,
  ReverseFinishedGoodsIssueDto,
  UpdateFinishedGoodsIssueDto,
  WithdrawFinishedGoodsIssueDto,
} from './dto/finished-goods-issue.dto';

@Injectable()
export class FinishedGoodsIssuesService {
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
      entity: FINISHED_GOODS_ISSUE_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async findIssue(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const issue = await client.finishedGoodsIssue.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: FINISHED_GOODS_ISSUE_INCLUDE,
    });
    if (!issue) throw this.notFound('finishedGoodsIssue.notFound');
    return issue;
  }

  private async findIssueByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.finishedGoodsIssue.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: FINISHED_GOODS_ISSUE_INCLUDE,
    });
  }

  private async resolveContext(dto: CreateFinishedGoodsIssueDto, ctx: ActiveOperationalContext, client: any) {
    const warehouse = await client.warehouse.findUnique({ where: { id: dto.issueWarehouseId } });
    if (!warehouse) throw this.notFound('finishedGoodsIssue.warehouseNotFound');
    if (warehouse.companyId !== ctx.companyId) throw this.badRequest('finishedGoodsIssue.warehouseTenantMismatch');
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.badRequest('finishedGoodsIssue.warehouseBranchMismatch');
    }

    const productIds = [...new Set(dto.lines.map((line) => line.productId))];
    const products = await client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const foundProducts = new Set(products.map((product: any) => product.id));
    for (const productId of productIds) {
      if (!foundProducts.has(productId)) throw this.notFound('finishedGoodsIssue.productNotFound');
    }

    // Only products that are the final output of an ACTIVE, non-deleted
    // ProductionProductDefinition in the active company/branch may leave the
    // finished-goods warehouse through this authority.
    const definitions = await client.productionProductDefinition.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        productId: { in: productIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { productId: true },
    });
    const eligibleProducts = new Set(definitions.map((definition: any) => definition.productId));
    for (const line of dto.lines) {
      if (!eligibleProducts.has(line.productId)) {
        throw this.badRequest('finishedGoodsIssue.productNotEligible');
      }
    }

    for (const line of dto.lines) {
      if (line.warehouseLocationId) {
        const location = await client.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
        if (!location) throw this.notFound('finishedGoodsIssue.locationNotFound');
        if (location.warehouseId !== warehouse.id) {
          throw this.badRequest('finishedGoodsIssue.locationWarehouseMismatch');
        }
      }
    }

    return { warehouse };
  }

  private lineToMovementLines(direction: 'IN' | 'OUT', dtoLines: CreateFinishedGoodsIssueLineDto[]) {
    return dtoLines.map((line) => ({
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

  private async createIssueWithMovement(
    client: any,
    ctx: ActiveOperationalContext,
    userId: string,
    warehouse: any,
    dto: { issueDate?: string; notes?: string; purpose?: string; lines: CreateFinishedGoodsIssueLineDto[]; requestId?: string },
    direction: 'IN' | 'OUT',
    sourceIssueId: string | null,
  ) {
    const issueNumber = await this.numberingService.generateNumberAtomicWithClient('FINISHED_GOODS_ISSUE', client);
    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', client);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

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
        movementType: direction === 'IN' ? FINISHED_GOODS_ISSUE_REVERSAL_MOVEMENT_TYPE : FINISHED_GOODS_ISSUE_MOVEMENT_TYPE,
        status: 'DRAFT',
        sourceType: FINISHED_GOODS_ISSUE_SOURCE_TYPE,
        sourceId: sourceIssueId,
        movementDate: issueDate,
        notes: dto.notes ?? null,
        createdById: userId,
        lines: { create: movementLines },
      },
    });

    const issue = await client.finishedGoodsIssue.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        issueNumber,
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
        lines: {
          create: dto.lines.map((line, index) => ({
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productId: line.productId,
            productCodeSnapshot: '',
            productNameSnapshot: '',
            unit: line.unit,
            quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
          })),
        },
      },
      include: FINISHED_GOODS_ISSUE_INCLUDE,
    });

    await client.finishedGoodsIssue.update({
      where: { id: issue.id },
      data: {
        lines: {
          update: issue.lines.map((line: any) => ({
            where: { id: line.id },
            data: {
              productCodeSnapshot: line.product?.code ?? '',
              productNameSnapshot: line.product?.name ?? '',
            },
          })),
        },
      },
    });

    return issue;
  }

  async create(dto: CreateFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findIssueByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const context = await this.resolveContext(dto, ctx, tx);
        const issue = await this.createIssueWithMovement(tx, ctx, userId, context.warehouse, dto, 'OUT', null);

        await this.writeAudit(tx, userId, 'CREATE', issue.id, ctx, {
          issueNumber: issue.issueNumber,
          movementId: issue.movementId,
          lineCount: dto.lines.length,
        });
        return issue;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx) : null;
        if (raced) return raced;
        throw this.conflict('finishedGoodsIssue.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: FinishedGoodsIssueQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.issueWarehouseId) where.issueWarehouseId = query.issueWarehouseId;
    if (query.status) where.status = query.status;
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
    const [data, total] = await Promise.all([
      (this.prisma as any).finishedGoodsIssue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ issueDate: 'desc' }],
        include: FINISHED_GOODS_ISSUE_INCLUDE,
      }),
      (this.prisma as any).finishedGoodsIssue.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    return this.withActorNames(issue);
  }

  /**
   * Resolves the scalar actor ids kept on the authority (created/submitted/
   * approved/rejected/withdrawn/posted/cancelled) to display names so the UI
   * never has to render a raw user id.
   */
  private async withActorNames<T extends Record<string, any>>(
    record: T,
    client: any = this.prisma,
  ): Promise<T & { actorNames: Record<string, string> }> {
    const ids = [
      'createdById',
      'submittedById',
      'approvedById',
      'rejectedById',
      'withdrawnById',
      'postedById',
      'cancelledById',
    ]
      .map((field) => record[field])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const unique = [...new Set(ids)];
    if (unique.length === 0) return { ...record, actorNames: {} };
    const users = await client.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return {
      ...record,
      actorNames: Object.fromEntries(users.map((user: any) => [user.id, user.name])),
    };
  }

  async update(id: string, dto: UpdateFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      if (issue.status !== 'DRAFT') throw this.badRequest('finishedGoodsIssue.notDraft');

      if (dto.lines && dto.lines.length > 0) {
        const warehouse = await tx.warehouse.findUnique({ where: { id: issue.issueWarehouseId } });
        if (!warehouse) throw this.notFound('finishedGoodsIssue.warehouseNotFound');
        await this.resolveContext(
          { issueWarehouseId: issue.issueWarehouseId, lines: dto.lines },
          ctx,
          tx,
        );

        await tx.finishedGoodsIssueLine.deleteMany({ where: { issueId: id } });
        await tx.finishedGoodsIssueLine.createMany({
          data: dto.lines.map((line, index) => ({
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            issueId: id,
            productId: line.productId,
            productCodeSnapshot: '',
            productNameSnapshot: '',
            unit: line.unit,
            quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
          })),
        });
        await tx.inventoryMovementLine.deleteMany({ where: { movementId: issue.movementId! } });
        const rebuiltMovementLines = await this.movementsService.resolveMovementLines(
          tx,
          this.lineToMovementLines('OUT', dto.lines),
        );
        await tx.inventoryMovementLine.createMany({
          data: rebuiltMovementLines.map((line) => ({ ...line, movementId: issue.movementId! })),
        });
        const refreshedLines = await tx.finishedGoodsIssueLine.findMany({
          where: { issueId: id },
          include: { product: { select: { id: true, code: true, name: true } } },
        });
        for (const line of refreshedLines) {
          await tx.finishedGoodsIssueLine.update({
            where: { id: line.id },
            data: {
              productCodeSnapshot: line.product?.code ?? '',
              productNameSnapshot: line.product?.name ?? '',
            },
          });
        }
      }

      const updated = await tx.finishedGoodsIssue.update({
        where: { id },
        data: {
          notes: dto.notes ?? issue.notes,
          purpose: dto.purpose ?? issue.purpose,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : issue.issueDate,
        },
        include: FINISHED_GOODS_ISSUE_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'UPDATE', id, ctx, { issueNumber: issue.issueNumber });
      return updated;
    });
  }

  /**
   * Single guarded status transition. The `updateMany` claim guarantees that two
   * concurrent decisions can never both succeed; every transition is audited with
   * the acting user and the previous/new status.
   */
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
      if (!fromStatuses.includes(issue.status)) throw this.badRequest('finishedGoodsIssue.invalidTransition');

      const claim = await tx.finishedGoodsIssue.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: { in: fromStatuses } },
        data,
      });
      if (claim.count !== 1) throw this.conflict('finishedGoodsIssue.invalidTransition');

      const updated = await tx.finishedGoodsIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: FINISHED_GOODS_ISSUE_INCLUDE,
      });
      if (!updated) throw this.notFound('finishedGoodsIssue.notFound');

      await this.writeAudit(tx, userId, action, id, ctx, {
        issueNumber: issue.issueNumber,
        oldStatus: issue.status,
        newStatus: data.status,
        ...auditDetails,
      });
      return updated;
    });
  }

  /** Requester submits a DRAFT finished-goods issue request to the warehouse. */
  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'DRAFT') throw this.badRequest('finishedGoodsIssue.notDraft');
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

  /** Requester withdraws a SUBMITTED request before the warehouse decides. */
  async withdraw(id: string, dto: WithdrawFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('finishedGoodsIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById !== userId) {
      throw this.forbidden('finishedGoodsIssue.onlyRequesterCanWithdraw');
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

  /** Warehouse approval. The decider must be a different actor from the requester. */
  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('finishedGoodsIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('finishedGoodsIssue.cannotApproveOwnRequest');
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

  /** Warehouse rejection: terminal for this request, with a mandatory reason. */
  async reject(id: string, dto: RejectFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'SUBMITTED') throw this.badRequest('finishedGoodsIssue.notSubmitted');
    if (issue.submittedById && issue.submittedById === userId) {
      throw this.badRequest('finishedGoodsIssue.cannotApproveOwnRequest');
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

  /** Warehouse cancels a prior approval before posting, returning it to SUBMITTED. */
  async cancelApproval(
    id: string,
    dto: CancelFinishedGoodsIssueApprovalDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const issue = await this.findIssue(id, ctx);
    if (issue.status !== 'APPROVED') throw this.badRequest('finishedGoodsIssue.notApproved');
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
      if (issue.status !== 'APPROVED') throw this.badRequest('finishedGoodsIssue.notApproved');
      if (!issue.movementId) throw this.badRequest('finishedGoodsIssue.movementMissing');

      await this.movementsService.postMovementWithinTransaction(tx, issue.movementId, userId, ctx);

      const posted = await tx.finishedGoodsIssue.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
        include: FINISHED_GOODS_ISSUE_INCLUDE,
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

  async cancel(id: string, dto: CancelFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.findIssue(id, ctx, tx);
      // A request can be cancelled while DRAFT, awaiting a warehouse decision, or
      // after rejection. APPROVED/POSTED documents can only be corrected through
      // cancel-approval/reversal.
      if (!['DRAFT', 'SUBMITTED', 'REJECTED'].includes(issue.status)) {
        throw this.badRequest('finishedGoodsIssue.invalidTransition');
      }

      if (issue.movementId) {
        const movement = await tx.inventoryMovement.findUnique({ where: { id: issue.movementId } });
        if (!movement) throw this.notFound('finishedGoodsIssue.movementMissing');
        if (movement.status === 'DRAFT') {
          await tx.inventoryMovement.update({
            where: { id: issue.movementId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
          });
        }
      }

      const claim = await tx.finishedGoodsIssue.updateMany({
        where: {
          id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, notes: dto.reason },
      });
      if (claim.count !== 1) throw this.conflict('finishedGoodsIssue.invalidTransition');

      const cancelled = await tx.finishedGoodsIssue.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: FINISHED_GOODS_ISSUE_INCLUDE,
      });
      if (!cancelled) throw this.notFound('finishedGoodsIssue.notFound');

      await this.writeAudit(tx, userId, 'CANCEL', id, ctx, {
        issueNumber: issue.issueNumber,
        oldStatus: issue.status,
        newStatus: 'CANCELLED',
        reason: dto.reason,
      });
      return cancelled;
    });
  }

  /**
   * Reverses a POSTED finished-goods issue by creating a new DRAFT issue whose
   * linked DRAFT movement carries an IN effect for the exact issued quantities.
   * The original issue is never mutated; a source can only be reversed once and a
   * reversal can never itself be reversed.
   */
  async reverse(id: string, dto: ReverseFinishedGoodsIssueDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findIssueByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findIssueByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const source = await this.findIssue(id, ctx, tx);
        if (source.status !== 'POSTED') throw this.badRequest('finishedGoodsIssue.reverseOnlyPosted');
        if (source.sourceType === 'REVERSE' || source.reversesIssueId) {
          throw this.badRequest('finishedGoodsIssue.cannotReverseReversal');
        }

        const existingReversal = await tx.finishedGoodsIssue.findFirst({
          where: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            reversesIssueId: source.id,
            status: { not: 'CANCELLED' },
          },
          select: { id: true },
        });
        if (existingReversal) throw this.conflict('finishedGoodsIssue.alreadyReversed');

        // Historical conversion replay: pair each source line with its immutable
        // InventoryMovementLine (product + quantity + OUT direction) so the IN
        // reversal movement replays the exact historical base quantity.
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
        const reverseLines: CreateFinishedGoodsIssueLineDto[] = source.lines.map((line: any) => {
          const evidence = takeMovementEvidence(line.productId, new Prisma.Decimal(line.quantity));
          const reversed: CreateFinishedGoodsIssueLineDto = {
            productId: line.productId,
            quantity: Number(line.quantity),
            unit: line.unit,
            warehouseLocationId: line.warehouseLocationId ?? undefined,
            batchNumber: line.batchNumber ?? undefined,
            serialNumber: line.serialNumber ?? undefined,
            expiryDate: line.expiryDate ? line.expiryDate.toISOString() : undefined,
          };
          if (evidence?.quantityBase) reversed.historicalQuantityBase = Number(evidence.quantityBase);
          return reversed;
        });

        const warehouse = source.issueWarehouseId
          ? await tx.warehouse.findUnique({ where: { id: source.issueWarehouseId } })
          : null;
        if (!warehouse) throw this.notFound('finishedGoodsIssue.warehouseNotFound');

        const reversal = await this.createIssueWithMovement(
          tx,
          ctx,
          userId,
          warehouse,
          {
            issueDate: dto.issueDate,
            notes: dto.notes ?? `Reverses issue ${source.issueNumber}`,
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
        throw this.conflict('finishedGoodsIssue.duplicateRequest');
      }
      throw error;
    }
  }
}
