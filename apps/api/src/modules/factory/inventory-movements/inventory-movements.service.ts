import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateInventoryMovementDto, CreateInventoryMovementLineDto } from './dto/create-inventory-movement.dto';
import { ReverseInventoryMovementDto } from './dto/reverse-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';
import {
  INVENTORY_VALUATION_BLOCKED_ACTIVE_SOURCE_TYPES,
  INVENTORY_VALUATION_VALUED_RECEIPT_MOVEMENT_TYPES,
} from '../inventory-valuation/inventory-valuation.constants';

const MOVEMENT_REVERSAL_SOURCE_TYPE = 'INVENTORY_MOVEMENT_REVERSAL';
const MOVEMENT_REVERSAL_TOKEN_PREFIX = 'REVERSAL:';

type ProductionMaterialValuationPlanEntry =
  | { kind: 'ISSUE' }
  | { kind: 'TRUE_RETURN'; originalUnitCost: Prisma.Decimal; originalEventValue: Prisma.Decimal };

@Injectable()
export class InventoryMovementsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  /**
   * Converts an optional date field and rejects syntactically invalid values so
   * an Invalid Date can never be stored. undefined stays undefined, empty/null
   * stays null.
   */
  private toDateOrThrow(value: string | null | undefined, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw this.validationError(field, 'validation.invalidValue', `Invalid date "${value}" for field ${field}`);
    }
    return date;
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ messageKey: 'inventory.movementNotFound', message });
  }

  private conflict(messageKey: string): ConflictException {
    return new ConflictException({ messageKey, message: messageKey });
  }

  private badRequest(messageKey: string): BadRequestException {
    return new BadRequestException({ messageKey, message: messageKey });
  }

  private isInContext(
    movement: { companyId: string; branchId: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return movement.companyId === ctx.companyId &&
      (movement.branchId === null || movement.branchId === ctx.branchId);
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!movement || movement.deletedAt || !this.isInContext(movement, ctx)) {
      throw this.notFound('Inventory movement not found');
    }
    return movement;
  }

  /**
   * Validates that a warehouse is active and belongs to the active operational
   * context, using the SAME transaction client that will perform the mutation.
   * Established supported relation: company-wide warehouses (branchId null) are
   * usable from any branch of the company; branch-bound warehouses are usable
   * from their own branch only.
   */
  private async assertWarehouseInContextWithClient(client: any, warehouseId: string, ctx: ActiveOperationalContext) {
    const warehouse = await client.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.deletedAt != null) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse not found');
    }
    if (warehouse.companyId !== ctx.companyId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another company');
    }
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another branch');
    }
    if (warehouse.status !== undefined && warehouse.status !== null && warehouse.status !== 'ACTIVE') {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse is inactive');
    }
    return warehouse;
  }

  private async assertLocationInWarehouseWithClient(client: any, locationId: string, warehouseId: string, field = 'warehouseLocationId') {
    const location = await client.warehouseLocation.findUnique({ where: { id: locationId } });
    if (!location || location.warehouseId !== warehouseId) {
      throw this.validationError(field, 'validation.invalidReference', 'Location does not belong to the movement warehouse');
    }
    if (location.status !== undefined && location.status !== null && location.status !== 'ACTIVE') {
      throw this.validationError(field, 'validation.invalidReference', 'Location is inactive');
    }
    return location;
  }

  /**
   * Products are a company-global catalog (no tenant column), so only existence
   * and non-deleted state are validated — matching the established inventory
   * domain rule. Validation runs on the transaction client that mutates.
   */
  private async assertProductActiveWithClient(client: any, productId: string) {
    const product = await client.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt != null) {
      throw this.validationError('productId', 'validation.invalidReference', 'Product not found or deleted');
    }
    return product;
  }

  /**
   * Revalidates the complete relation graph of a stored movement using the SAME
   * transaction client that will perform the mutation. Used by post and reversal
   * paths so a tenant-owned movement can never become authority for
   * foreign/deleted/inactive warehouse, location, or product records, and so
   * hostile legacy rows (created before relation validation existed) are
   * rejected before any inventory mutation.
   */
  private async assertMovementRelationsWithClient(
    client: any,
    movement: { warehouseId: string; lines: { productId: string; warehouseLocationId: string | null }[] },
    ctx: ActiveOperationalContext,
  ): Promise<void> {
    const warehouse = await this.assertWarehouseInContextWithClient(client, movement.warehouseId, ctx);
    for (const line of movement.lines) {
      if (line.warehouseLocationId) {
        await this.assertLocationInWarehouseWithClient(client, line.warehouseLocationId, warehouse.id, 'lines.warehouseLocationId');
      }
      await this.assertProductActiveWithClient(client, line.productId);
    }
  }

  /**
   * Phase 2 — tenant-scoped idempotency lookup. requestId is unique per
   * (companyId, branchId) so a duplicate submission from the same tenant returns
   * the previously committed movement. Company-level movements (branchId null)
   * are visible to every branch of the company.
   */
  private async findMovementByRequestId(
    requestId: string,
    ctx: ActiveOperationalContext,
    client: any = this.prisma,
  ) {
    return client.inventoryMovement.findFirst({
      where: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], requestId, deletedAt: null },
      include: { lines: true },
    });
  }

  /**
   * Canonical fingerprint of an incoming create payload. Only business-relevant
   * fields participate so that a retry of the same submission is stable.
   */
  private fingerprintCreatePayload(dto: CreateInventoryMovementDto): string {
    const lines = [...dto.lines]
      .map((l) => [
        l.productId,
        l.warehouseLocationId ?? '',
        Number(l.quantity).toFixed(4),
        Number(l.quantityBase ?? l.quantity).toFixed(4),
        l.batchNumber ?? '',
        l.serialNumber ?? '',
        l.direction,
        l.unit ?? '',
      ].join(':'))
      .sort()
      .join('~');
    return [dto.warehouseId, dto.movementType, dto.sourceType ?? '', dto.sourceId ?? '', lines].join('|');
  }

  /**
   * Canonical fingerprint of a stored movement. Mirrors fingerprintCreatePayload
   * so that "same requestId + same payload" is detected and "same requestId +
   * different payload" is rejected as a canonical conflict.
   */
  private fingerprintStoredMovement(movement: any): string {
    const lines = (movement.lines ?? [])
      .map((l: any) => [
        l.productId,
        l.warehouseLocationId ?? '',
        Number(l.quantity).toFixed(4),
        Number(l.quantityBase ?? l.quantity).toFixed(4),
        l.batchNumber ?? '',
        l.serialNumber ?? '',
        l.direction,
        l.unit ?? '',
      ].join(':'))
      .sort()
      .join('~');
    return [movement.warehouseId, movement.movementType, movement.sourceType ?? '', movement.sourceId ?? '', lines].join('|');
  }

  private resolveIdempotentCreate(existing: any, dto: CreateInventoryMovementDto) {
    if (this.fingerprintCreatePayload(dto) !== this.fingerprintStoredMovement(existing)) {
      throw this.conflict('inventory.movementRequestConflict');
    }
    return existing;
  }

  private resolveIdempotentReverse(existing: any, dto: ReverseInventoryMovementDto) {
    const sameNotes = !dto.notes || existing.notes === dto.notes;
    const sameDate = !dto.movementDate || existing.movementDate.toISOString() === new Date(dto.movementDate).toISOString();
    if (!sameNotes || !sameDate) {
      throw this.conflict('inventory.movementRequestConflict');
    }
    return existing;
  }

  /**
   * Phase 2 — tenant-harded create. The client-supplied companyId/branchId are
   * not accepted at all (removed from the DTO): the movement is always created
   * in the active operational context. All relation validation runs on the SAME
   * transaction client that performs the mutation, and number generation happens
   * only after every validation passes, inside the same transaction.
   */
  async create(dto: CreateInventoryMovementDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findMovementByRequestId(dto.requestId, ctx);
      if (existing) return this.resolveIdempotentCreate(existing, dto);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findMovementByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return this.resolveIdempotentCreate(raced, dto);

        const company = await tx.company.findUnique({ where: { id: ctx.companyId } });
        if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

        const warehouse = await this.assertWarehouseInContextWithClient(tx, dto.warehouseId, ctx);

        for (const line of dto.lines) {
          if (line.quantity <= 0) {
            throw this.validationError('lines', 'validation.invalidQuantity', 'Quantity must be greater than 0');
          }
          if (!['IN', 'OUT'].includes(line.direction)) {
            throw this.validationError('lines', 'validation.invalidValue', `Invalid direction "${line.direction}". Must be IN or OUT`);
          }
          await this.assertProductActiveWithClient(tx, line.productId);
          if (line.warehouseLocationId) {
            await this.assertLocationInWarehouseWithClient(tx, line.warehouseLocationId, warehouse.id, 'lines.warehouseLocationId');
          }
        }

        // Number generation happens only after every relation validation passes.
        const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

        const { lines, ...rest } = dto;

        const movement = await tx.inventoryMovement.create({
          data: {
            ...rest,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            movementNumber,
            status: 'DRAFT',
            createdById: userId,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                warehouseLocationId: l.warehouseLocationId,
                quantity: l.quantity,
                quantityBase: l.quantityBase ?? l.quantity,
                batchNumber: l.batchNumber,
                serialNumber: l.serialNumber,
                expiryDate: this.toDateOrThrow(l.expiryDate, 'lines.expiryDate'),
                unit: l.unit,
                direction: l.direction,
                notes: l.notes,
              })),
            },
          },
          include: { lines: true },
        });

        await this.audit.logWithClient(tx, {
          userId,
          action: 'CREATE',
          entity: 'InventoryMovement',
          entityId: movement.id,
          details: { companyId: ctx.companyId, branchId: ctx.branchId, movementNumber: movement.movementNumber, requestId: dto.requestId ?? null },
        });
        return movement;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findMovementByRequestId(dto.requestId, ctx) : null;
        if (raced) return this.resolveIdempotentCreate(raced, dto);
        throw this.conflict('inventory.movementRequestConflict');
      }
      throw error;
    }
  }

  async findAll(query: InventoryMovementQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    where.AND = [{ OR: [{ branchId: ctx.branchId }, { branchId: null }] }];
    if (query.search) {
      where.AND.push({ OR: [
        { movementNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ] });
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.movementType) where.movementType = query.movementType;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  /**
   * Phase 2 — tenant-hardened update. Ownership re-check, DRAFT status check,
   * and the mutation all happen in ONE transaction so a raced tenant change or
   * a concurrent post/cancel cannot be combined with stale validation.
   */
  async update(id: string, dto: UpdateInventoryMovementDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Inventory movement not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanUpdate');

      const updated = await tx.inventoryMovement.update({
        where: { id },
        data: { notes: dto.notes },
      });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'UPDATE',
        entity: 'InventoryMovement',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId },
      });
      return updated;
    });
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    // Idempotent: an already committed post returns the same committed result.
    if (movement.status === 'POSTED') return movement;
    if (movement.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanPost');

    const posted = await this.prisma.$transaction(async (tx) => {
      return this.postMovementWithinTransaction(tx, id, userId, ctx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return posted;
  }

  /**
   * Phase 1.7 — Posts a DRAFT inventory movement and applies its balance effects inside an
   * existing transaction. Production inventory documents call this inside their own atomic
   * transaction so that the production source record, its linked InventoryMovement, and the
   * resulting inventory_balances are committed or rolled back together.
   *
   * Writes both the legacy Float `quantity` and the phase 1.7 Decimal shadow `quantityBase`
   * to keep the balance dual-compatible during the precision migration. All balance arithmetic
   * is performed with Prisma.Decimal (18,4); the legacy Float is derived from the Decimal result.
   *
   * Phase 2 — the caller must open the transaction with Serializable isolation so the
   * find-then-update balance write is race-safe (the find is no longer the sole protection)
   * and the negative-stock guard cannot be bypassed by concurrent OUT postings.
   *
   * Phase 2 hardening: the complete relation graph is revalidated on the same transaction
   * client, and the DRAFT -> POSTED transition is an atomic updateMany claim performed
   * BEFORE any balance mutation. A concurrent double post therefore cannot re-apply balance
   * effects: the loser either sees claim count 0 (already posted) or is serialized after the
   * winner and rejects before touching inventory_balances.
   */
  async postMovementWithinTransaction(tx: any, id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.postMovementCore(tx, id, userId, ctx, null);
  }

  /**
   * VAL-R1F canonical production-material entrypoint. Keeping this separate from
   * generic movement posting prevents a caller from making an arbitrary
   * PRODUCTION_MATERIAL_DOCUMENT movement valuation-eligible without proving the
   * tenant-owned document, document type, and original-return linkage.
   */
  async postProductionMaterialMovementWithinTransaction(
    tx: any,
    documentId: string,
    movementId: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    return this.postMovementCore(tx, movementId, userId, ctx, documentId);
  }

  private async postMovementCore(
    tx: any,
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
    productionMaterialDocumentId: string | null,
  ) {
    const movement = await tx.inventoryMovement.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!movement || movement.deletedAt || !this.isInContext(movement, ctx)) {
      throw this.notFound('Inventory movement not found');
    }
    if (movement.status !== 'DRAFT') {
      // Idempotent re-entry: an already POSTED movement must never re-apply its
      // balance effects. Any other terminal state cannot be posted.
      if (movement.status === 'POSTED') return movement;
      throw this.badRequest('inventory.movementOnlyDraftCanPost');
    }

    // Revalidate the complete relation graph inside the posting transaction,
    // before any claim or balance mutation (hostile legacy rows are rejected).
    await this.assertMovementRelationsWithClient(tx, movement, ctx);

    // Atomic double-post claim: only one concurrent post can win the
    // DRAFT -> POSTED transition. The guarded updateMany takes the row lock,
    // so the loser cannot apply balance effects even if it entered the loop.
    const claim = await tx.inventoryMovement.updateMany({
      where: { id: movement.id, status: 'DRAFT', deletedAt: null },
      data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
    });
    if (claim.count !== 1) {
      const reRead = await tx.inventoryMovement.findUnique({ where: { id } });
      if (reRead && reRead.status === 'POSTED') return reRead;
      throw this.badRequest('inventory.movementOnlyDraftCanPost');
    }

    // Audit only after the claim succeeded: the POST audit is recorded for every
    // posting flow (endpoint and production callers) exactly once.
    await this.audit.logWithClient(tx, {
      userId,
      action: 'POST',
      entity: 'InventoryMovement',
      entityId: movement.id,
      details: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        oldStatus: 'DRAFT',
        newStatus: 'POSTED',
        warehouseId: movement.warehouseId,
        lineCount: movement.lines.length,
      },
    });

    // VAL-R1C: resolve whether the movement's warehouse has an ACTIVE valuation
    // policy and, if so, whether this movement is eligible for valuation. Non-active
    // and future-scope (production/finished-goods) postings are handled here:
    // future-scope flows are blocked BEFORE any physical stock change.
    const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(
      tx,
      ctx.companyId,
      movement.warehouseId,
    );

    let productionValuationPlan: Map<string, ProductionMaterialValuationPlanEntry> | null = null;
    if (activePolicy) {
      if (productionMaterialDocumentId) {
        // Lock every touched product in deterministic order before reading the
        // return history, physical qold, or monetary state.
        const uniqueScopes = new Map<string, { companyId: string; warehouseId: string; productId: string }>();
        for (const line of movement.lines) {
          const scope = { companyId: ctx.companyId, warehouseId: movement.warehouseId, productId: line.productId };
          uniqueScopes.set(`${scope.companyId}\u0000${scope.warehouseId}\u0000${scope.productId}`, scope);
        }
        await this.valuationEngine.acquireValuationLocksSorted(tx, [...uniqueScopes.values()]);
        productionValuationPlan = await this.resolveProductionMaterialValuationPlan(
          tx,
          productionMaterialDocumentId,
          movement,
          activePolicy,
          ctx,
        );
      } else {
        // Generic callers and finished-goods callers remain governed by the
        // existing active-flow classifier.
        await this.resolveValuedMovementFlow(tx, movement, ctx);
      }
    }

    for (const line of movement.lines) {
      const balance = await this.getOrCreateBalance(
        tx,
        movement.warehouseId,
        line.productId,
        line.warehouseLocationId,
        line.batchNumber,
        line.serialNumber,
        line.expiryDate,
      );

      const deltaBase = new Prisma.Decimal(line.quantityBase ?? line.quantity)
        .mul(line.direction === 'IN' ? 1 : -1);
      const currentBase = new Prisma.Decimal(balance.quantityBase ?? balance.quantity);
      const newQuantityBase = currentBase.add(deltaBase);

      if (newQuantityBase.isNegative()) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        throw new BadRequestException(
          `Insufficient stock for product ${product?.name || line.productId}. Available: ${currentBase.toString()}, Requested: ${line.quantity}`,
        );
      }

      // VAL-R1C: for an ACTIVE valuation warehouse the physical increase/decrease
      // and the monetary moving-average update happen in this SAME transaction
      // (await engine call === atomic). Valuation is applied against the physical
      // quantity BEFORE this line's own balance write, so `qold` is authoritative.
      if (activePolicy) {
        const qold = await this.valuationEngine.aggregatePhysicalQuantity(
          tx,
          movement.warehouseId,
          line.productId,
        );
        const productionEntry = productionValuationPlan?.get(line.id);
        if (productionValuationPlan && !productionEntry) {
          throw this.badRequest('inventoryValuation.productionMaterialLineMismatch');
        }
        if (productionEntry?.kind === 'TRUE_RETURN') {
          await this.valuationEngine.applyTrueReturn(tx, {
            companyId: ctx.companyId,
            warehouseId: movement.warehouseId,
            productId: line.productId,
            qold,
            quantity: new Prisma.Decimal(line.quantityBase ?? line.quantity),
            lineId: line.id,
            movementId: movement.id,
            originalUnitCost: productionEntry.originalUnitCost,
            originalEventValue: productionEntry.originalEventValue,
            currencyCode: activePolicy.currencyCode,
          });
        } else if (line.direction === 'OUT') {
          await this.valuationEngine.applyValuedIssue(tx, {
            companyId: ctx.companyId,
            warehouseId: movement.warehouseId,
            productId: line.productId,
            qold,
            quantity: new Prisma.Decimal(line.quantityBase ?? line.quantity),
            lineId: line.id,
            movementId: movement.id,
            currencyCode: activePolicy.currencyCode,
          });
        } else {
          // Inbound movement into an ACTIVE warehouse without a trusted receipt
          // cost is blocked (VALUATION_UNSUPPORTED_ACTIVE_FLOW).
          throw new BadRequestException({
            messageKey: 'inventoryValuation.costRequired',
            message: 'An inbound stock movement into an ACTIVE valuation warehouse requires a valued receipt source',
          });
        }
      }

      const newQuantity = Number(newQuantityBase.toFixed(4));
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, quantityBase: newQuantityBase },
      });
    }

    return tx.inventoryMovement.findUnique({
      where: { id },
      include: { lines: true },
    });
  }

  private productionMaterialLineKey(line: any): string {
    const expiry = line.expiryDate ? new Date(line.expiryDate).toISOString() : '';
    const quantity = new Prisma.Decimal(line.quantityBase ?? line.quantity).toDecimalPlaces(4).toFixed(4);
    return [
      line.productId,
      line.warehouseLocationId ?? '',
      line.batchNumber ?? '',
      line.serialNumber ?? '',
      expiry,
      quantity,
    ].join('|');
  }

  /**
   * Builds a complete one-to-one plan between production document lines and
   * movement lines. ISSUE/CONSUMPTION uses the current moving average. RETURN is
   * allowed only when the exact original POSTED issue line and its immutable
   * movement quartet can be proven. Any missing, ambiguous, cross-tenant,
   * over-returned, or altered link is blocked before physical stock changes.
   */
  private async resolveProductionMaterialValuationPlan(
    tx: any,
    documentId: string,
    movement: any,
    activePolicy: { currencyCode: string; method: string },
    ctx: ActiveOperationalContext,
  ): Promise<Map<string, ProductionMaterialValuationPlanEntry>> {
    const doc = await tx.productionMaterialDocument.findFirst({
      where: { id: documentId, companyId: ctx.companyId, branchId: ctx.branchId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!doc || doc.status !== 'DRAFT' || doc.movementId !== movement.id || doc.issueWarehouseId !== movement.warehouseId) {
      throw this.badRequest('inventoryValuation.productionMaterialDocumentMismatch');
    }
    if (movement.sourceType !== 'PRODUCTION_MATERIAL_DOCUMENT') {
      throw this.badRequest('inventoryValuation.productionMaterialSourceMismatch');
    }

    const expectedMovementTypes: Record<string, string> = {
      ISSUE: 'PRODUCTION_ISSUE',
      CONSUMPTION: 'PRODUCTION_CONSUMPTION',
      RETURN: 'PRODUCTION_RETURN',
    };
    const expectedMovementType = expectedMovementTypes[doc.documentType];
    if (!expectedMovementType || movement.movementType !== expectedMovementType) {
      // SUBSTITUTION and every future production material type remain safely
      // blocked until a dedicated valuation contract is implemented.
      throw this.badRequest('inventoryValuation.unsupportedActiveFlow');
    }

    const expectedDirection = doc.documentType === 'RETURN' ? 'IN' : 'OUT';
    if (movement.lines.length !== doc.lines.length || movement.lines.some((line: any) => line.direction !== expectedDirection)) {
      throw this.badRequest('inventoryValuation.productionMaterialLineMismatch');
    }

    const unmatchedMovementLines = [...movement.lines];
    const plan = new Map<string, ProductionMaterialValuationPlanEntry>();
    for (const docLine of doc.lines) {
      const key = this.productionMaterialLineKey(docLine);
      const movementIndex = unmatchedMovementLines.findIndex((line: any) => this.productionMaterialLineKey(line) === key);
      if (movementIndex < 0) throw this.badRequest('inventoryValuation.productionMaterialLineMismatch');
      const movementLine = unmatchedMovementLines.splice(movementIndex, 1)[0];

      if (doc.documentType !== 'RETURN') {
        plan.set(movementLine.id, { kind: 'ISSUE' });
        continue;
      }

      if (!docLine.originalIssueLineId) {
        throw this.badRequest('inventoryValuation.productionReturnOriginalIssueRequired');
      }
      const original = await tx.productionMaterialDocumentLine.findFirst({
        where: {
          id: docLine.originalIssueLineId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          productId: docLine.productId,
          document: {
            productionOrderId: doc.productionOrderId,
            issueWarehouseId: movement.warehouseId,
            status: 'POSTED',
            documentType: { in: ['ISSUE', 'CONSUMPTION'] },
          },
        },
        include: { document: { include: { movement: { include: { lines: true } } } } },
      });
      const originalMovement = original?.document?.movement;
      if (!original || !originalMovement || originalMovement.status !== 'POSTED') {
        throw this.badRequest('inventoryValuation.productionReturnOriginalIssueInvalid');
      }

      const originalCandidates = originalMovement.lines.filter(
        (line: any) => line.direction === 'OUT' && this.productionMaterialLineKey(line) === this.productionMaterialLineKey(original),
      );
      if (originalCandidates.length !== 1) {
        throw this.badRequest('inventoryValuation.productionReturnOriginalMovementAmbiguous');
      }
      const originalMovementLine = originalCandidates[0];
      if (
        originalMovementLine.unitCost == null ||
        originalMovementLine.totalCost == null ||
        originalMovementLine.currencyCode !== activePolicy.currencyCode ||
        originalMovementLine.valuationMethod !== 'WEIGHTED_AVERAGE'
      ) {
        throw this.badRequest('inventoryValuation.productionReturnOriginalCostMissing');
      }
      const originalUnitCost = new Prisma.Decimal(originalMovementLine.unitCost);
      const expectedOriginalTotal = new Prisma.Decimal(original.quantity).mul(originalUnitCost).toDecimalPlaces(4);
      if (!expectedOriginalTotal.equals(new Prisma.Decimal(originalMovementLine.totalCost))) {
        throw this.badRequest('inventoryValuation.productionReturnOriginalCostInvalid');
      }

      const priorReturnLines = await tx.productionMaterialDocumentLine.findMany({
        where: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          originalIssueLineId: original.id,
          documentId: { not: doc.id },
          document: { documentType: 'RETURN', status: 'POSTED', issueWarehouseId: movement.warehouseId },
        },
        include: { document: { include: { movement: { include: { lines: true } } } } },
      });
      const previouslyReturned = priorReturnLines.reduce(
        (sum: Prisma.Decimal, line: any) => sum.plus(new Prisma.Decimal(line.quantity)),
        new Prisma.Decimal(0),
      );
      const currentReturnQuantity = new Prisma.Decimal(docLine.quantity);
      const originalQuantity = new Prisma.Decimal(original.quantity);
      if (previouslyReturned.plus(currentReturnQuantity).gt(originalQuantity)) {
        throw this.badRequest('inventoryValuation.productionReturnExceedsOriginalIssue');
      }

      let previouslyReturnedValue = new Prisma.Decimal(0);
      for (const prior of priorReturnLines) {
        const priorMovement = prior.document?.movement;
        const candidates = priorMovement?.lines?.filter(
          (line: any) => line.direction === 'IN' && this.productionMaterialLineKey(line) === this.productionMaterialLineKey(prior),
        ) ?? [];
        if (candidates.length !== 1 || candidates[0].totalCost == null) {
          throw this.badRequest('inventoryValuation.productionReturnPriorEvidenceInvalid');
        }
        previouslyReturnedValue = previouslyReturnedValue.plus(new Prisma.Decimal(candidates[0].totalCost));
      }
      const isFinalRemainder = previouslyReturned.plus(currentReturnQuantity).eq(originalQuantity);
      const originalEventValue = isFinalRemainder
        ? new Prisma.Decimal(originalMovementLine.totalCost).minus(previouslyReturnedValue)
        : currentReturnQuantity.mul(originalUnitCost);
      if (originalEventValue.isNegative()) {
        throw this.badRequest('inventoryValuation.productionReturnPriorEvidenceInvalid');
      }

      plan.set(movementLine.id, { kind: 'TRUE_RETURN', originalUnitCost, originalEventValue });
    }

    if (unmatchedMovementLines.length !== 0 || plan.size !== movement.lines.length) {
      throw this.badRequest('inventoryValuation.productionMaterialLineMismatch');
    }
    return plan;
  }

  /**
   * VAL-R1C: classifies a movement being posted against an ACTIVE valuation
   * warehouse. Returns 'ISSUE' for a generic OUT (valued issue) movement, or
   * throws (before any stock change) for a blocked or unvalued flow:
   *   - future-scope sources (production / finished-goods / maintenance /
   *     adjustments / transfer / count) → VALUATION_UNSUPPORTED_ACTIVE_FLOW
   *   - reversal / true-return of a valued movement → blocked for R1C
   *     (TRUE_RETURN is DEFERRED_BLOCKED; original-cost linkage deferred).
   * Inbound generic lines are additionally rejected by the line-level guard.
   */
  private async resolveValuedMovementFlow(
    tx: any,
    movement: { movementType: string; sourceType: string | null; reversesMovementId?: string | null; lines: { direction: string }[] },
    ctx: ActiveOperationalContext,
  ): Promise<'ISSUE' | null> {
    if (movement.sourceType === MOVEMENT_REVERSAL_SOURCE_TYPE || movement.reversesMovementId) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.unsupportedActiveFlow',
        message: 'Movement reversal / true-return into an ACTIVE valuation warehouse is not supported in VAL-R1C',
      });
    }
    if (INVENTORY_VALUATION_BLOCKED_ACTIVE_SOURCE_TYPES.includes(movement.sourceType as string)) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.unsupportedActiveFlow',
        message: `Movement source ${movement.sourceType} is not supported for an ACTIVE valuation warehouse`,
      });
    }
    // A generic issue movement (all OUT) is the valued issue path. Any inbound
    // line is rejected by the line-level cost guard.
    return 'ISSUE';
  }

  /**
   * Phase 2 — Reverses a POSTED movement by creating a NEW compensating DRAFT movement
   * with flipped line directions. The original movement is never deleted or mutated, so
   * the audit trail and the inventory history remain intact. Posting the compensating
   * movement nets the balances back to zero.
   *
   * Phase 2 hardening — the compensating movement always carries a deterministic
   * `requestId` token derived from the compensated movement id. The SQL Server filtered
   * unique index on (companyId, branchId, requestId) WHERE requestId IS NOT NULL therefore
   * permits at most ONE reversal per original movement per tenant, making concurrent
   * double reversal impossible at the database level without any schema change. A retry
   * (with or without a client requestId) returns the already-committed reversal
   * idempotently via the token lookup.
   */
  async reverse(id: string, dto: ReverseInventoryMovementDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findMovementByRequestId(dto.requestId, ctx);
      if (existing) return this.resolveIdempotentReverse(existing, dto);
    }

    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'POSTED') throw this.badRequest('inventory.movementOnlyPostedCanReverse');
    if (movement.reversesMovementId) throw this.badRequest('inventory.movementReversalCannotReverse');

    const reversalToken = `${MOVEMENT_REVERSAL_TOKEN_PREFIX}${id}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findMovementByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return this.resolveIdempotentReverse(raced, dto);

        // Any prior reversal of the same original movement (committed under any
        // client requestId) resolves this submission idempotently.
        const priorByToken = await this.findMovementByRequestId(reversalToken, ctx, tx);
        if (priorByToken) return this.resolveIdempotentReverse(priorByToken, dto);

        const current = await tx.inventoryMovement.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
          throw this.notFound('Inventory movement not found');
        }
        if (current.status !== 'POSTED') throw this.badRequest('inventory.movementOnlyPostedCanReverse');
        if (current.reversesMovementId) throw this.badRequest('inventory.movementReversalCannotReverse');

        const reversalNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);
        const reversal = await tx.inventoryMovement.create({
          data: {
            movementNumber: reversalNumber,
            companyId: ctx.companyId,
            branchId: current.branchId,
            warehouseId: current.warehouseId,
            movementType: current.movementType,
            status: 'DRAFT',
            sourceType: MOVEMENT_REVERSAL_SOURCE_TYPE,
            sourceId: current.id,
            reversesMovementId: current.id,
            requestId: reversalToken,
            movementDate: this.toDateOrThrow(dto.movementDate, 'movementDate') ?? new Date(),
            notes: dto.notes ?? `Reverses movement ${current.movementNumber}`,
            createdById: userId,
            lines: {
              create: current.lines.map((l) => ({
                productId: l.productId,
                warehouseLocationId: l.warehouseLocationId,
                quantity: l.quantity,
                quantityBase: l.quantityBase ?? l.quantity,
                batchNumber: l.batchNumber,
                serialNumber: l.serialNumber,
                expiryDate: l.expiryDate,
                unit: l.unit,
                direction: l.direction === 'IN' ? 'OUT' : 'IN',
                notes: l.notes ?? `Reverses line of movement ${current.movementNumber}`,
              })),
            },
          },
          include: { lines: true },
        });

        await this.audit.logWithClient(tx, {
          userId,
          action: 'REVERSE',
          entity: 'InventoryMovement',
          entityId: current.id,
          details: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            reversalMovementId: reversal.id,
            reversalNumber: reversal.movementNumber,
            lineCount: current.lines.length,
          },
        });
        return reversal;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findMovementByRequestId(dto.requestId, ctx) : null;
        if (raced) return this.resolveIdempotentReverse(raced, dto);
        const prior = await this.findMovementByRequestId(reversalToken, ctx);
        if (prior) return this.resolveIdempotentReverse(prior, dto);
        throw this.conflict('inventory.movementRequestConflict');
      }
      throw error;
    }
  }

  /**
   * Phase 2 — tenant-hardened cancel. The guarded DRAFT -> CANCELLED updateMany
   * is the atomic claim: a concurrent post can win the DRAFT state first, and
   * the cancel then loses cleanly instead of mutating a POSTED movement.
   */
  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Inventory movement not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanCancel');

      const claim = await tx.inventoryMovement.updateMany({
        where: { id: current.id, status: 'DRAFT', deletedAt: null },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
      });
      if (claim.count !== 1) {
        const reRead = await tx.inventoryMovement.findUnique({ where: { id } });
        if (reRead && reRead.status === 'CANCELLED') return reRead;
        throw this.badRequest('inventory.movementOnlyDraftCanCancel');
      }

      await this.audit.logWithClient(tx, {
        userId,
        action: 'CANCEL',
        entity: 'InventoryMovement',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, oldStatus: current.status, newStatus: 'CANCELLED' },
      });
      return tx.inventoryMovement.findUnique({ where: { id } });
    });
  }

  /**
   * Phase 2 — tenant-hardened line operations. Ownership re-check, DRAFT status
   * check, relation validation, the mutation, and the audit all share one
   * transaction so a concurrent post/cancel cannot combine with stale validation.
   */
  async addLine(id: string, dto: CreateInventoryMovementLineDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Inventory movement not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanModify');
      if (dto.quantity <= 0) throw this.validationError('quantity', 'validation.invalidQuantity', 'Quantity must be greater than 0');
      if (!['IN', 'OUT'].includes(dto.direction)) throw this.validationError('direction', 'validation.invalidValue', 'Direction must be IN or OUT');

      await this.assertProductActiveWithClient(tx, dto.productId);
      if (dto.warehouseLocationId) {
        await this.assertLocationInWarehouseWithClient(tx, dto.warehouseLocationId, current.warehouseId, 'warehouseLocationId');
      }

      const line = await tx.inventoryMovementLine.create({
        data: {
          movementId: id,
          productId: dto.productId,
          warehouseLocationId: dto.warehouseLocationId,
          quantity: dto.quantity,
          quantityBase: dto.quantityBase ?? dto.quantity,
          batchNumber: dto.batchNumber,
          serialNumber: dto.serialNumber,
          expiryDate: this.toDateOrThrow(dto.expiryDate, 'expiryDate'),
          unit: dto.unit,
          direction: dto.direction,
          notes: dto.notes,
        },
        include: { product: { select: { id: true, name: true, code: true } } },
      });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'ADD_LINE',
        entity: 'InventoryMovement',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, lineId: line.id, productId: dto.productId, quantity: dto.quantity },
      });
      return line;
    });
  }

  /**
   * Phase 2 — tenant-hardened line update. Only explicitly listed fields are
   * written and every one is re-validated in-transaction; the raw DTO is never
   * passed through to the database.
   */
  async updateLine(id: string, lineId: string, dto: Partial<CreateInventoryMovementLineDto>, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Inventory movement not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanModify');

      const line = await tx.inventoryMovementLine.findUnique({ where: { id: lineId } });
      if (!line || line.movementId !== id) throw this.notFound('Movement line not found');

      const data: any = {};
      if (dto.productId !== undefined) {
        await this.assertProductActiveWithClient(tx, dto.productId);
        data.productId = dto.productId;
      }
      if (dto.quantity !== undefined) {
        if (dto.quantity <= 0) throw this.validationError('quantity', 'validation.invalidQuantity', 'Quantity must be greater than 0');
        data.quantity = dto.quantity;
      }
      if (dto.quantityBase !== undefined) {
        if (dto.quantityBase <= 0) throw this.validationError('quantityBase', 'validation.invalidQuantity', 'Quantity must be greater than 0');
        data.quantityBase = dto.quantityBase;
      }
      if (dto.direction !== undefined) {
        if (!['IN', 'OUT'].includes(dto.direction)) throw this.validationError('direction', 'validation.invalidValue', 'Direction must be IN or OUT');
        data.direction = dto.direction;
      }
      if (dto.warehouseLocationId !== undefined) {
        if (dto.warehouseLocationId) {
          await this.assertLocationInWarehouseWithClient(tx, dto.warehouseLocationId, current.warehouseId, 'warehouseLocationId');
        }
        data.warehouseLocationId = dto.warehouseLocationId || null;
      }
      if (dto.batchNumber !== undefined) data.batchNumber = dto.batchNumber;
      if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber;
      if (dto.expiryDate !== undefined) data.expiryDate = this.toDateOrThrow(dto.expiryDate, 'expiryDate');
      if (dto.unit !== undefined) data.unit = dto.unit;
      if (dto.notes !== undefined) data.notes = dto.notes;

      const updated = await tx.inventoryMovementLine.update({
        where: { id: lineId },
        data,
        include: { product: { select: { id: true, name: true, code: true } } },
      });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'UPDATE_LINE',
        entity: 'InventoryMovement',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, lineId },
      });
      return updated;
    });
  }

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Inventory movement not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.movementOnlyDraftCanModify');

      const line = await tx.inventoryMovementLine.findUnique({ where: { id: lineId } });
      if (!line || line.movementId !== id) throw this.notFound('Movement line not found');

      await tx.inventoryMovementLine.delete({ where: { id: lineId } });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'REMOVE_LINE',
        entity: 'InventoryMovement',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, lineId },
      });
      return { message: 'Line removed successfully' };
    });
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    const lines = await this.prisma.inventoryMovementLine.findMany({
      where: { movementId: id },
      select: { direction: true, quantity: true },
    });
    const totalInQty = lines.filter(l => l.direction === 'IN').reduce((s, l) => s + l.quantity, 0);
    const totalOutQty = lines.filter(l => l.direction === 'OUT').reduce((s, l) => s + l.quantity, 0);
    return { movementId: id, movementNumber: movement.movementNumber, status: movement.status, lineCount: lines.length, totalInQty, totalOutQty };
  }

  private async getOrCreateBalance(
    tx: any,
    warehouseId: string,
    productId: string,
    locationId: string | null | undefined,
    batchNumber?: string | null,
    serialNumber?: string | null,
    expiryDate?: Date | null,
  ) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    if (batchNumber) where.batchNumber = batchNumber; else where.batchNumber = null;
    if (serialNumber) where.serialNumber = serialNumber; else where.serialNumber = null;
    let balance = await tx.inventoryBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: {
          warehouseId,
          productId,
          locationId: locationId || null,
          quantity: 0,
          quantityBase: 0,
          batchNumber: batchNumber || null,
          serialNumber: serialNumber || null,
          expiryDate: expiryDate || null,
        },
      });
    }
    return balance;
  }
}
