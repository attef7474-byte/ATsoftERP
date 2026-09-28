import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { IssueStockDto, ReturnStockDto } from './dto/issue-stock.dto';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { assertWarehouseInContext, assertMachineInContext as assertMachineTenantInContext } from '../../../../common/operational-context/tenant-guards';
import { MAINTENANCE_COST_PURPOSE, isCostPurpose, type CostPurpose } from '../../../../common/cost-purpose/cost-purpose.constants';
import { MATERIAL_EVENT_TYPE, canonicalLedgerUnit } from '../../production-cost/production-cost.constants';
import { assertCostPurposeOverrideAllowed } from '../../../../common/cost-purpose/cost-purpose-permission';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { ProductionCostService } from '../../production-cost/production-cost.service';

const VALID_STOCK_CONDITIONS = ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'];
const VALID_REPLACEMENT_ACTIONS = ['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'];
const FORBIDDEN_WAREHOUSE_TYPES = ['PRODUCT', 'RAW_MATERIAL'];

@Injectable()
export class MaintenanceStockIssueService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private conditionService: SparePartConditionService,
    private installedPartsService: InstalledPartsReplacementService,
    private valuationEngine: InventoryValuationEngineService,
    private productionCost: ProductionCostService,
  ) {}

  /**
   * COST-R1B: canonical PRIMARY_COST ledger projection for a valued maintenance
   * material OUT issue. Only called when the issue carried explicit valuation
   * evidence (an ACTIVE policy produced a valued movement line with totalCost and
   * currencyCode). Legacy/unvalued issues (no line id, no totalCost, no currency)
   * are intentionally skipped without throwing. Runs on the SAME tx so a ledger
   * failure rolls back the whole issue.
   */
  private async postMaintenanceMaterialLedgerEntry(
    tx: any,
    opts: {
      movementId: string;
      lineId: string;
      maintenanceRequestId: string;
      totalCost: Prisma.Decimal;
      currencyCode: string;
      quantity: Prisma.Decimal;
      unit: string;
      sourceNumber: string;
      movementDate: Date;
      createdById: string;
      ctx: ActiveOperationalContext;
    },
  ) {
    if (!opts.lineId || !opts.totalCost || !opts.currencyCode) {
      return;
    }
    await this.productionCost.postLedgerEntryWithinTransaction(tx, {
      eventType: MATERIAL_EVENT_TYPE,
      sourceType: 'INVENTORY_MOVEMENT_LINE',
      sourceId: opts.lineId,
      sourceLineId: opts.lineId,
      costNature: 'ACTUAL',
      costPurpose: MAINTENANCE_COST_PURPOSE,
      entryRole: 'PRIMARY_COST',
      amount: opts.totalCost,
      quantity: opts.quantity,
      unit: canonicalLedgerUnit(opts.unit),
      currencyCode: null,
      occurredAt: opts.movementDate,
      clientRequestId: `${opts.movementId}-line:${opts.lineId}-maintenance-issue`,
      requestPayloadFingerprint: `${opts.movementId}-line:${opts.lineId}-maintenance-issue`,
      sourceNumberSnapshot: opts.sourceNumber,
      refs: {
        maintenanceRequestId: opts.maintenanceRequestId,
        _currencyCodeFromInventory: opts.currencyCode,
        _sourceKind: 'MAINTENANCE_MATERIAL',
      },
      createdById: opts.createdById,
      ctx: opts.ctx,
    });
  }

  private async findPartLineOrFail(lineId: string, requestId: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        maintenanceRequest: {
          include: {
            machine: {
              select: {
                id: true, companyId: true, branchId: true,
                productionLineId: true, departmentId: true,
                defaultCostCenterId: true, name: true, code: true,
              },
            },
          },
        },
        sparePart: {
          select: {
            id: true, productId: true, code: true, name: true,
            technicalClassification: true, usageType: true, nature: true, importance: true,
          },
        },
        machineComponent: {
          select: { id: true, name: true, code: true, machineId: true },
        },
      },
    });
    if (!part) throw new NotFoundException('Part line not found');
    if (part.maintenanceRequestId !== requestId) {
      throw new BadRequestException('Part line does not belong to this request');
    }
    this.assertMachineInContext(part.maintenanceRequest.machine, ctx);
    return part as any;
  }

  private assertMachineInContext(
    machine: { id: string; companyId: string | null; branchId: string | null },
    ctx: ActiveOperationalContext,
  ): void {
    if (!machine || machine.companyId !== ctx.companyId) {
      throw new ForbiddenException('forbidden: part line machine does not belong to active company');
    }
    if (machine.branchId && machine.branchId !== ctx.branchId) {
      throw new ForbiddenException('forbidden: part line machine does not belong to active branch');
    }
  }

  private computeIssueStatus(issued: number, returned: number, approved: number): string {
    const netIssued = issued - returned;
    if (netIssued <= 0) return 'NOT_ISSUED';
    if (netIssued >= approved) return 'FULLY_ISSUED';
    return 'PARTIALLY_ISSUED';
  }

  private badRequest(messageKey: string, message: string, params?: Record<string, string | number>) {
    return new BadRequestException({ messageKey, message, ...(params ? { params } : {}) });
  }

  private notFound(messageKey: string, message: string) {
    return new NotFoundException({ messageKey, message });
  }

  /**
   * R2-E — replacement action contract. The three actions are mutually exclusive
   * and each carries its own mandatory/field-forbidden set, so a NEW_INSTALLATION
   * can never be smuggled in as a replacement (which would fabricate an old part)
   * and a no-return replacement can never fake a stock return.
   *
   *   NEW_INSTALLATION      — installs a new part, replaces NOTHING.
   *                          oldInstalledPartId MUST be absent.
   *   RETURNED_REMOVED_PART — a true replacement of an ACTUAL installed part whose
   *                          removal comes back to condition stock.
   *                          oldInstalledPartId + removed condition + removed
   *                          quantity + return warehouse are mandatory.
   *   NO_REMOVED_PART       — a true replacement where the removed part never came
   *                          back. oldInstalledPartId + noReturnReason mandatory;
   *                          return facts are forbidden.
   */
  private validateReplacementAction(dto: IssueStockDto) {
    if (!dto.replacementAction) {
      throw this.badRequest(
        'maintenance.replacementActionRequired',
        `replacementAction is required (${VALID_REPLACEMENT_ACTIONS.join(', ')})`,
      );
    }
    if (!VALID_REPLACEMENT_ACTIONS.includes(dto.replacementAction)) {
      throw this.badRequest(
        'maintenance.replacementActionInvalid',
        `Invalid replacementAction '${dto.replacementAction}'. Must be one of: ${VALID_REPLACEMENT_ACTIONS.join(', ')}`,
        { action: dto.replacementAction, allowed: VALID_REPLACEMENT_ACTIONS.join(', ') },
      );
    }

    const hasRemovedPartField =
      dto.removedPartCondition != null ||
      dto.removedPartWarehouseId != null ||
      dto.removedPartQuantity != null ||
      dto.removedPartReturnedByUserId != null;

    if (dto.replacementAction === 'NEW_INSTALLATION') {
      if (dto.oldInstalledPartId) {
        throw this.badRequest(
          'maintenance.replacementNewInstallationRejectsOldPart',
          'oldInstalledPartId is not accepted for NEW_INSTALLATION because a new installation replaces no existing installed part',
        );
      }
      if (hasRemovedPartField || dto.noReturnReason) {
        throw this.badRequest(
          'maintenance.replacementNewInstallationRejectsRemovedPartFields',
          'Removed-part and no-return fields are not accepted for NEW_INSTALLATION because no part was removed',
        );
      }
      return;
    }

    // Both true-replacement actions require the ACTUAL installed part being removed.
    if (!dto.oldInstalledPartId) {
      throw this.badRequest(
        'maintenance.replacementOldInstalledPartRequired',
        `oldInstalledPartId is required when replacementAction is ${dto.replacementAction}`,
      );
    }

    if (dto.replacementAction === 'RETURNED_REMOVED_PART') {
      if (!dto.removedPartCondition) {
        throw this.badRequest(
          'maintenance.replacementRemovedPartConditionRequired',
          'removedPartCondition is required when replacementAction is RETURNED_REMOVED_PART',
        );
      }
      if (!dto.removedPartWarehouseId) {
        throw this.badRequest(
          'maintenance.replacementRemovedPartWarehouseRequired',
          'removedPartWarehouseId is required when replacementAction is RETURNED_REMOVED_PART',
        );
      }
      if (!dto.removedPartQuantity || dto.removedPartQuantity <= 0) {
        throw this.badRequest(
          'maintenance.replacementRemovedPartQuantityRequired',
          'removedPartQuantity (positive) is required when replacementAction is RETURNED_REMOVED_PART',
        );
      }
      if (!VALID_STOCK_CONDITIONS.includes(dto.removedPartCondition)) {
        throw this.badRequest(
          'maintenance.replacementRemovedPartConditionInvalid',
          `Invalid removedPartCondition '${dto.removedPartCondition}'`,
          { condition: dto.removedPartCondition },
        );
      }
      if (dto.noReturnReason) {
        throw this.badRequest(
          'maintenance.replacementReturnedRejectsNoReturnReason',
          'noReturnReason is not accepted when the removed part is RETURNED_REMOVED_PART',
        );
      }
    }

    if (dto.replacementAction === 'NO_REMOVED_PART') {
      if (!dto.noReturnReason) {
        throw this.badRequest(
          'maintenance.replacementNoReturnReasonRequired',
          'noReturnReason is required when replacementAction is NO_REMOVED_PART',
        );
      }
      if (hasRemovedPartField) {
        throw this.badRequest(
          'maintenance.replacementNoReturnRejectsReturnFields',
          'Removed-part return fields are not accepted when replacementAction is NO_REMOVED_PART because no stock return occurred',
        );
      }
    }
  }

  /**
   * R2-E — the old installed part selection contract, evaluated inside the
   * replacement transaction. The returned record is the SERVER authority for the
   * removed physical part; the client never supplies the old spare part or old
   * product identity.
   *
   * Validated: existence, ACTIVE status (not already removed/replaced), same
   * machine, same machine component when the request line is component-scoped,
   * machine-level when the line is machine-level, and tenant ownership through the
   * owning machine.
   *
   * `lockOldInstalledPartForReplacement` must be called on the same transaction
   * immediately before this method, so this read runs under the UPDLOCK/HOLDLOCK
   * lock. That is what makes a concurrent double replacement of the SAME physical
   * installed part impossible without a schema unique constraint: the second
   * writer re-reads the row as REMOVED and fails the ACTIVE check above.
   */
  private async resolveOldInstalledPartForReplacement(
    tx: any,
    dto: IssueStockDto,
    part: any,
    ctx: ActiveOperationalContext,
  ): Promise<{
    id: string;
    sparePartId: string;
    productId: string | null;
    machineId: string;
    machineComponentId: string | null;
    installedQuantity: number;
    installedCondition: string;
    sparePart: { id: string; code: string; name: string; productId: string | null };
  }> {
    const oldInstalledPartId = dto.oldInstalledPartId!;
    const machineId = part.maintenanceRequest.machine.id;
    const requestComponentId = part.machineComponent?.id ?? part.machineComponentId ?? null;

    const oldPart = await tx.machineInstalledPart.findUnique({
      where: { id: oldInstalledPartId },
      select: {
        id: true,
        machineId: true,
        machineComponentId: true,
        sparePartId: true,
        productId: true,
        installedQuantity: true,
        installedCondition: true,
        status: true,
        machine: { select: { id: true, companyId: true, branchId: true } },
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
      },
    });

    // A missing record and a foreign-tenant record are reported identically so
    // the endpoint never discloses another company's installed-part ids.
    if (!oldPart) {
      throw this.notFound(
        'maintenance.replacementOldInstalledPartNotFound',
        'The selected old installed part does not exist in the active company and branch',
      );
    }
    if (oldPart.machine.companyId !== ctx.companyId) {
      throw this.notFound(
        'maintenance.replacementOldInstalledPartNotFound',
        'The selected old installed part does not exist in the active company and branch',
      );
    }
    if (oldPart.machine.branchId && oldPart.machine.branchId !== ctx.branchId) {
      throw this.notFound(
        'maintenance.replacementOldInstalledPartNotFound',
        'The selected old installed part does not exist in the active company and branch',
      );
    }

    if (oldPart.status !== 'ACTIVE') {
      throw this.badRequest(
        'maintenance.replacementOldInstalledPartNotActive',
        `The selected old installed part is in status '${oldPart.status}' and can no longer be replaced`,
      );
    }

    if (oldPart.machineId !== machineId) {
      throw this.badRequest(
        'maintenance.replacementOldInstalledPartMachineMismatch',
        'The selected old installed part does not belong to this request machine',
      );
    }

    // Component identity: a component-scoped request line may only remove a part
    // installed on that same component, and a machine-level line may only remove a
    // machine-level installed part. Neither may silently cross the boundary, and no
    // fake component is invented.
    const oldComponentId = oldPart.machineComponentId ?? null;
    if (requestComponentId || oldComponentId) {
      if (oldComponentId !== requestComponentId) {
        throw this.badRequest(
          'maintenance.replacementOldInstalledPartComponentMismatch',
          'The selected old installed part does not belong to the machine component of this request part line',
        );
      }
    }

    // R2-E partial-removal decision: the current installed-part model has a single
    // ACTIVE/REMOVED status and no residual-quantity field, so a partial removal
    // cannot be represented safely. The replacement is therefore fail-closed to a
    // FULL removal of the whole physical installed record.
    const installedQuantity = Number(oldPart.installedQuantity || 0);
    if (!(installedQuantity > 0)) {
      throw this.badRequest(
        'maintenance.replacementOldInstalledPartQuantityInvalid',
        'The selected old installed part has no active installed quantity to remove',
      );
    }
    if (dto.replacementAction === 'RETURNED_REMOVED_PART' && dto.removedPartQuantity !== installedQuantity) {
      throw this.badRequest(
        'maintenance.replacementPartialRemovalNotSupported',
        `Partial removal is not supported: removedPartQuantity must equal the selected old installed part's installed quantity (${installedQuantity})`,
        { installedQuantity: String(installedQuantity), requestedQuantity: String(dto.removedPartQuantity) },
      );
    }

    return {
      id: oldPart.id,
      sparePartId: oldPart.sparePartId,
      productId: oldPart.productId ?? oldPart.sparePart.productId ?? null,
      machineId: oldPart.machineId,
      machineComponentId: oldComponentId,
      installedQuantity,
      installedCondition: oldPart.installedCondition,
      sparePart: oldPart.sparePart,
    };
  }

  /**
   * R2-E — take the canonical SQL Server serialization lock on the old installed
   * part row for the rest of the replacement transaction. Two concurrent
   * replacements of the SAME physical installed part are serialized here: the
   * second transaction re-reads the row after the first commits and fails the
   * ACTIVE re-check with a canonical 400 instead of double-removing it.
   */
  private async lockOldInstalledPartForReplacement(tx: any, oldInstalledPartId: string, ctx: ActiveOperationalContext) {
    await tx.$queryRaw(Prisma.sql`
      SELECT [id]
      FROM [dbo].[machine_installed_parts] WITH (UPDLOCK, HOLDLOCK)
      WHERE [id] = ${oldInstalledPartId}
    `);
    // Defense in depth: the same lock identity is only ever taken for a row that
    // the caller has already proven to belong to the active company/branch.
    const owned = await tx.machineInstalledPart.findFirst({
      where: {
        id: oldInstalledPartId,
        machine: {
          companyId: ctx.companyId,
          OR: [{ branchId: ctx.branchId }, { branchId: null }],
        },
      },
      select: { id: true },
    });
    if (!owned) {
      throw this.notFound(
        'maintenance.replacementOldInstalledPartNotFound',
        'The selected old installed part does not exist in the active company and branch',
      );
    }
  }

  private validateStockCondition(dto: IssueStockDto) {
    if (dto.issuedStockCondition && !VALID_STOCK_CONDITIONS.includes(dto.issuedStockCondition)) {
      throw new BadRequestException(`Invalid issuedStockCondition '${dto.issuedStockCondition}'`);
    }
  }

  async issue(requestId: string, lineId: string, dto: IssueStockDto, userId: string, ctx: ActiveOperationalContext) {
    const part: any = await this.findPartLineOrFail(lineId, requestId, ctx);
    if (!['APPROVED', 'RESERVED'].includes(part.status)) {
      throw new BadRequestException(`Cannot issue stock for part in status '${part.status}'. Must be APPROVED or RESERVED`);
    }

    this.validateReplacementAction(dto);
    this.validateStockCondition(dto);

    const approvableQty = part.approvedQuantity || part.requestedQuantity || part.quantity;
    const currentIssued = part.issuedQuantity || 0;
    const currentReturned = part.returnedQuantity || 0;
    const netIssued = currentIssued - currentReturned;
    const remaining = approvableQty - netIssued;

    if (dto.issuedQuantity > remaining) {
      throw new BadRequestException(
        `Issued quantity ${dto.issuedQuantity} exceeds remaining issuable quantity ${remaining}. Approved: ${approvableQty}, Already issued net: ${netIssued}`,
      );
    }

    const productId = part.sparePart.productId;
    if (!productId) {
      throw new BadRequestException('Spare part has no linked product. Cannot issue stock.');
    }

    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    if (dto.warehouseLocationId) {
      const location = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.warehouseLocationId } });
      if (!location || location.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the selected warehouse');
      }
    }
    if (dto.removedPartWarehouseId) {
      await assertWarehouseInContext(this.prisma, dto.removedPartWarehouseId, ctx);
    }

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    const wt = warehouse.warehouseType || '';
    if (FORBIDDEN_WAREHOUSE_TYPES.includes(wt)) {
      throw new BadRequestException(`Spare parts cannot be issued from ${wt.toLowerCase().replace('_', ' ')} warehouses`);
    }

    // Auto-derive cost hierarchy from machine when not provided
    const machine = part.maintenanceRequest.machine;
    const derivedCostData: any = {};

    // Derive department/line from machine if cost fields not provided
    if (!dto.costDepartmentId && machine.departmentId) derivedCostData.costDepartmentId = machine.departmentId;
    if (!dto.costProductionLineId && machine.productionLineId) derivedCostData.costProductionLineId = machine.productionLineId;
    if (!dto.costMachineId) derivedCostData.costMachineId = machine.id;
    if (!dto.costMachineComponentId && part.machineComponentId) derivedCostData.costMachineComponentId = part.machineComponentId;

    // Derive classification from SparePart catalog (never trust frontend)
    const sparePart = part.sparePart;
    derivedCostData.issuedStockCondition = dto.issuedStockCondition || 'NEW';
    derivedCostData.replacementAction = dto.replacementAction;

    // Cost Purpose R1 — canonical "WHY". Source default is MAINTENANCE. A
    // non-default requested value is an override: requires the canonical
    // cost-purpose:override permission and a mandatory reason, and is audited.
    let costPurpose: CostPurpose = MAINTENANCE_COST_PURPOSE;
    let costPurposeOverrideReason: string | null = null;
    let costPurposeOverridden = false;
    if (dto.costPurpose != null) {
      if (!isCostPurpose(dto.costPurpose)) {
        throw new BadRequestException(`Invalid costPurpose '${dto.costPurpose}'. Must be one of: MAINTENANCE, PRODUCTION, QUALITY, PROJECT, UTILITIES, ADMIN, DEVELOPMENT, OTHER`);
      }
      if (dto.costPurpose !== MAINTENANCE_COST_PURPOSE) {
        await assertCostPurposeOverrideAllowed(this.prisma, userId);
        if (!dto.costPurposeOverrideReason) {
          throw new BadRequestException('costPurposeOverrideReason is required when overriding the default Cost Purpose');
        }
        costPurpose = dto.costPurpose;
        costPurposeOverrideReason = dto.costPurposeOverrideReason;
        costPurposeOverridden = true;
      }
    }
    derivedCostData.costPurpose = costPurpose;
    derivedCostData.costPurposeOverrideReason = costPurposeOverrideReason;

    const companyId = ctx.companyId;
    const branchId = ctx.branchId;

    const isReplacement = dto.replacementAction !== 'NEW_INSTALLATION';

    const movement = await this.withTransientTransactionRetry(() => this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);
      await assertMachineTenantInContext(tx, part.maintenanceRequest.machine.id, ctx);
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      if (dto.warehouseLocationId) {
        const location = await tx.warehouseLocation.findUnique({ where: { id: dto.warehouseLocationId } });
        if (!location || location.warehouseId !== dto.warehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the selected warehouse');
        }
      }
      if (dto.removedPartWarehouseId) {
        await assertWarehouseInContext(tx, dto.removedPartWarehouseId, ctx);
      }

      // ── R2-E: old installed part is locked and resolved FIRST ──────────────
      // The lock is taken before any mutation so two concurrent replacements of the
      // SAME physical installed part serialize; the loser re-reads a REMOVED row and
      // fails with a canonical 400. The resolved record is the server authority for
      // the removed part's spare-part and product identity.
      let oldInstalled: Awaited<ReturnType<typeof this.resolveOldInstalledPartForReplacement>> | null = null;
      if (isReplacement) {
        await this.lockOldInstalledPartForReplacement(tx, dto.oldInstalledPartId!, ctx);
        oldInstalled = await this.resolveOldInstalledPartForReplacement(tx, dto, part, ctx);
      }

      // Re-read mutable issue totals inside the transaction. Concurrent requests
      // may both pass the outer authorization/business preflight against the same
      // snapshot; using that stale snapshot here loses one issuedQuantity update.
      // The in-transaction state is the write authority and is re-evaluated on a
      // bounded P2034 retry together with every dependent inventory mutation.
      const transactionalPart = await tx.maintenanceRequestRequiredPart.findUnique({
        where: { id: lineId },
        select: {
          approvedQuantity: true,
          requestedQuantity: true,
          quantity: true,
          issuedQuantity: true,
          returnedQuantity: true,
        },
      });
      if (!transactionalPart) throw new NotFoundException('Part line not found');
      const transactionalApprovableQty =
        transactionalPart.approvedQuantity || transactionalPart.requestedQuantity || transactionalPart.quantity;
      const transactionalIssued = transactionalPart.issuedQuantity || 0;
      const transactionalReturned = transactionalPart.returnedQuantity || 0;
      const transactionalRemaining = transactionalApprovableQty - (transactionalIssued - transactionalReturned);
      if (dto.issuedQuantity > transactionalRemaining) {
        throw new BadRequestException(
          `Issued quantity ${dto.issuedQuantity} exceeds remaining issuable quantity ${transactionalRemaining}. Approved: ${transactionalApprovableQty}, Already issued net: ${transactionalIssued - transactionalReturned}`,
        );
      }

      const balance = await this.getOrCreateBalance(tx, dto.warehouseId, productId, dto.warehouseLocationId);
      const delta = -dto.issuedQuantity;
      const newQuantity = balance.quantity + delta;

      const movement = await tx.inventoryMovement.create({
        data: {
          movementNumber,
          companyId,
          branchId,
          warehouseId: dto.warehouseId,
          movementType: 'MAINTENANCE_ISSUE',
          status: 'POSTED',
          sourceType: 'MAINTENANCE_PART_LINE',
          sourceId: lineId,
          movementDate: new Date(),
          postedAt: new Date(),
          createdById: userId,
          postedById: userId,
          notes: dto.notes || null,
          lines: {
            create: [{
              productId,
              warehouseLocationId: dto.warehouseLocationId || null,
              quantity: dto.issuedQuantity,
              direction: 'OUT',
              notes: `Maintenance stock issue for spare part ${part.sparePart.code} - ${part.sparePart.name}`,
            }],
          },
        },
        include: { lines: true },
      });

      // VAL-R1E: for an ACTIVE valuation warehouse the physical decrement,
      // monetary decrement, and immutable movement monetary quartet are all
      // applied atomically by the SINGLE inventory valuation authority. The
      // valuation engine acquires the applock, validates available quantity
      // (negative stock blocked), decrements physical stock exactly once and
      // inventory value exactly once, and writes the movement-line snapshot
      // (unitCost/totalCost/currencyCode/valuationMethod) at the current
      // weighted moving average. When no ACTIVE policy exists the legacy
      // unprotected behavior (physical only) is preserved for backward
      // compatibility (as in VAL-R1C inactive flows).
      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, companyId, dto.warehouseId);
      if (activePolicy) {
        if (newQuantity < 0) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          throw new BadRequestException(
            `Insufficient stock for product ${product?.name || productId}. Available: ${balance.quantity}, Requested: ${dto.issuedQuantity}`,
          );
        }
        const qold = await this.valuationEngine.aggregatePhysicalQuantity(tx, dto.warehouseId, productId);
        const issuedLine = movement.lines[0];
        const valuedIssue = await this.valuationEngine.applyValuedIssue(tx, {
          companyId,
          warehouseId: dto.warehouseId,
          productId,
          qold,
          lineId: issuedLine.id,
          movementId: movement.id,
          currencyCode: activePolicy.currencyCode,
          quantity: new Prisma.Decimal(dto.issuedQuantity),
        });
        // COST-R1B: project the valued maintenance material OUT issue into the
        // unified cost ledger as a canonical PRIMARY_COST entry. Guarded to
        // valued issues only (the legacy/unvalued path has no monetary evidence
        // and is skipped). Runs on the SAME tx so a ledger failure rolls back the
        // whole issue.
        await this.postMaintenanceMaterialLedgerEntry(tx, {
          movementId: movement.id,
          lineId: issuedLine.id,
          // RequiredPart owns the request; linked work orders have no per-issue allocation.
          maintenanceRequestId: part.maintenanceRequestId,
          totalCost: valuedIssue.totalCost,
          currencyCode: valuedIssue.currencyCode,
          quantity: new Prisma.Decimal(dto.issuedQuantity),
          unit: (issuedLine as any).unit ?? 'pcs',
          sourceNumber: movementNumber,
          movementDate: movement.movementDate,
          createdById: userId,
          ctx,
        });
      } else if (newQuantity < 0) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        throw new BadRequestException(
          `Insufficient stock for product ${product?.name || productId}. Available: ${balance.quantity}, Requested: ${dto.issuedQuantity}`,
        );
      }

      // Physical decrement exactly once for both ACTIVE and INACTIVE flows,
      // twin-syncing the legacy Float `quantity` and the Decimal `quantityBase`
      // (physical authority = SUM(quantityBase)). This mirrors the proven
      // R1C/R1D inventory-balance mutation pattern; the valuation engine is the
      // single monetary authority and is called above with the PRE-mutation
      // `qold`, while this single physical write applies the decrement.
      const currentBase =
        balance.quantityBase !== null && balance.quantityBase !== undefined
          ? new Prisma.Decimal(balance.quantityBase.toString())
          : new Prisma.Decimal(balance.quantity);
      const newQuantityBase = currentBase.minus(new Prisma.Decimal(dto.issuedQuantity));
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, quantityBase: newQuantityBase },
      });

      const newIssued = transactionalIssued + dto.issuedQuantity;
      const newStatus = this.computeIssueStatus(newIssued, transactionalReturned, transactionalApprovableQty);

      const costData: any = { ...derivedCostData };
      // Only override derived values if user explicitly provided them
      if (dto.costOwnerType) costData.costOwnerType = dto.costOwnerType;
      if (dto.costOwnerAdministrationId) costData.costOwnerAdministrationId = dto.costOwnerAdministrationId;
      if (dto.costDepartmentId) costData.costDepartmentId = dto.costDepartmentId;
      if (dto.costProductionLineId) costData.costProductionLineId = dto.costProductionLineId;
      if (dto.costMachineId) costData.costMachineId = dto.costMachineId;
      if (dto.costMachineComponentId) costData.costMachineComponentId = dto.costMachineComponentId;
      if (dto.unitCost != null) costData.unitCost = dto.unitCost;
      if (dto.unitCost != null) costData.totalCost = dto.issuedQuantity * dto.unitCost;
      if (dto.receivedByUserId) { costData.receivedByUserId = dto.receivedByUserId; costData.receivedAt = new Date(); }

      // R2-E: the removed-part facts recorded on the request line are the legitimate
      // removal facts only. No spare-part or product identity is ever taken from the
      // client for the removed part.
      if (dto.removedPartCondition) costData.removedPartCondition = dto.removedPartCondition;
      if (dto.removedPartWarehouseId) costData.removedPartWarehouseId = dto.removedPartWarehouseId;
      if (oldInstalled) costData.removedPartQuantity = oldInstalled.installedQuantity;
      if (dto.removedPartReturnedByUserId) costData.removedPartReturnedByUserId = dto.removedPartReturnedByUserId;
      if (dto.noReturnReason) costData.noReturnReason = dto.noReturnReason;

      await tx.maintenanceRequestRequiredPart.update({
        where: { id: lineId },
        data: {
          issuedQuantity: newIssued,
          stockIssueStatus: newStatus,
          warehouseId: dto.warehouseId,
          lastIssueAt: new Date(),
          lastIssueByUserId: userId,
          ...costData,
        },
      });

      // Record condition OUT for the NEWLY ISSUED part.
      const issuedCondition = dto.issuedStockCondition || 'NEW';
      const outMovement = await this.recordConditionMovementInTx(tx, {
        sparePartId: part.sparePart.id,
        productId,
        warehouseId: dto.warehouseId,
        condition: issuedCondition,
        direction: 'OUT',
        quantity: dto.issuedQuantity,
        sourceType: 'MAINTENANCE_ISSUE',
        sourceId: lineId,
        maintenanceRequestId: requestId,
        requiredPartId: lineId,
        inventoryMovementId: movement.id,
        replacementAction: dto.replacementAction,
        notes: `Issued ${dto.issuedQuantity} of spare part ${part.sparePart.code} (condition: ${issuedCondition})`,
      }, userId, ctx);
      const conditionOutMovementId = outMovement?.id;

      // Record the NEW installed part (always ACTIVE).
      const installedPart = await this.installedPartsService.recordInstalledPartInTx(tx, {
        machineId: part.maintenanceRequest.machine.id,
        machineComponentId: part.machineComponent?.id || null,
        sparePartId: part.sparePart.id,
        productId: part.sparePart.productId || null,
        maintenanceRequestId: requestId,
        requiredPartId: lineId,
        inventoryMovementId: movement.id,
        conditionMovementId: conditionOutMovementId,
        installedQuantity: dto.issuedQuantity,
        installedCondition: issuedCondition,
        installedByUserId: userId,
        sourceType: 'MAINTENANCE_ISSUE',
        sourceId: lineId,
        notes: dto.notes || null,
      });

      // ── R2-E: remove the OLD installed part, then account for the removed part ──
      // The single canonical removal authority is
      // InstalledPartsReplacementService.markInstalledPartRemovedInTx. Removal is
      // never duplicated in another service.
      let conditionInMovementId: string | null = null;
      let removedQuantity: number | null = null;
      let removedCondition: string | null = null;
      if (oldInstalled) {
        removedQuantity = oldInstalled.installedQuantity;
        removedCondition = dto.removedPartCondition || null;

        await this.installedPartsService.markInstalledPartRemovedInTx(tx, oldInstalled.id, {
          removedByUserId: userId,
          removedCondition,
          removedQuantity,
          removedReason: dto.replacementAction === 'RETURNED_REMOVED_PART'
            ? 'MAINTENANCE_REPLACEMENT_RETURNED_TO_STOCK'
            : `MAINTENANCE_REPLACEMENT_NOT_RETURNED: ${dto.noReturnReason || 'NO_REMOVED_PART'}`,
          newStatus: 'REMOVED',
        });

        // RETURNED_REMOVED_PART only: the condition IN movement describes the part
        // that physically came back, so it MUST carry the OLD spare-part and OLD
        // product identity — never the newly issued part. A NO_REMOVED_PART
        // replacement writes NO condition IN movement at all.
        if (dto.replacementAction === 'RETURNED_REMOVED_PART' && dto.removedPartCondition && dto.removedPartWarehouseId) {
          const inMovement = await this.recordConditionMovementInTx(tx, {
            sparePartId: oldInstalled.sparePartId,
            productId: oldInstalled.productId,
            warehouseId: dto.removedPartWarehouseId,
            condition: dto.removedPartCondition,
            direction: 'IN',
            quantity: oldInstalled.installedQuantity,
            sourceType: 'MAINTENANCE_REMOVED_PART_RETURN',
            sourceId: lineId,
            maintenanceRequestId: requestId,
            requiredPartId: lineId,
            inventoryMovementId: movement.id,
            replacementAction: dto.replacementAction,
            notes: `Returned removed part ${oldInstalled.sparePart.code} (condition: ${dto.removedPartCondition}, qty: ${oldInstalled.installedQuantity})`,
          }, userId, ctx);
          if (inMovement) conditionInMovementId = inMovement.id;
        }
      }

      // Record the immutable replacement event. OLD and NEW identity are always
      // both present and always distinct records, even when the catalog spare part
      // is identical.
      if (isReplacement && oldInstalled && dto.replacementAction !== undefined && dto.replacementAction !== 'NEW_INSTALLATION') {
        await this.installedPartsService.recordReplacementInTx(tx, {
          machineId: part.maintenanceRequest.machine.id,
          machineComponentId: part.machineComponent?.id || null,
          maintenanceRequestId: requestId,
          requiredPartId: lineId,
          oldInstalledPartId: oldInstalled.id,
          oldSparePartId: oldInstalled.sparePartId,
          newInstalledPartId: installedPart.id,
          newSparePartId: part.sparePart.id,
          issuedCondition,
          issuedQuantity: dto.issuedQuantity,
          removedCondition,
          removedQuantity,
          replacementAction: dto.replacementAction,
          noReturnReason: dto.noReturnReason || null,
          removedReturnedToStock: dto.replacementAction === 'RETURNED_REMOVED_PART',
          conditionOutMovementId,
          conditionInMovementId,
          inventoryOutMovementId: movement.id,
          replacedByUserId: userId,
          notes: dto.notes || null,
        });
      }

      return movement;
    // R2-E: Serializable isolation plus the UPDLOCK/HOLDLOCK row lock on the old
    // installed part is what makes a concurrent double replacement of the SAME
    // physical installed part safe without a schema unique constraint. A losing
    // writer is retried on P2034 and then fails the ACTIVE re-check canonically.
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    await this.audit.log(userId, 'ISSUE_STOCK', 'MaintenanceRequestRequiredPart', lineId, {
      movementId: movement.id,
      movementNumber: movement.movementNumber,
      issuedQuantity: dto.issuedQuantity,
      warehouseId: dto.warehouseId,
      productId,
      replacementAction: dto.replacementAction,
      issuedStockCondition: dto.issuedStockCondition,
    });

    // R2-E accountability: the old→new physical part identity transition is an
    // audited event of its own, with both installed-part records and both
    // catalog/part identities so no downstream consumer can confuse them.
    if (dto.replacementAction !== 'NEW_INSTALLATION') {
      const history = await this.prisma.sparePartReplacementHistory.findFirst({
        where: { inventoryOutMovementId: movement.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          replacementNumber: true,
          oldInstalledPartId: true,
          oldSparePartId: true,
          newInstalledPartId: true,
          newSparePartId: true,
          removedCondition: true,
          removedQuantity: true,
          removedReturnedToStock: true,
          conditionOutMovementId: true,
          conditionInMovementId: true,
          inventoryOutMovementId: true,
        },
      });
      if (history) {
        await this.audit.log(userId, 'MACHINE_INSTALLED_PART_REPLACED', 'SparePartReplacementHistory', history.id, {
          replacementNumber: history.replacementNumber,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          maintenanceRequestId: requestId,
          requiredPartId: lineId,
          machineId: part.maintenanceRequest.machine.id,
          machineComponentId: part.machineComponent?.id || null,
          replacementAction: dto.replacementAction,
          oldInstalledPartId: history.oldInstalledPartId,
          oldSparePartId: history.oldSparePartId,
          oldRemovedQuantity: history.removedQuantity,
          oldRemovedCondition: history.removedCondition,
          oldReturnedToStock: history.removedReturnedToStock,
          newInstalledPartId: history.newInstalledPartId,
          newSparePartId: history.newSparePartId,
          conditionOutMovementId: history.conditionOutMovementId,
          conditionInMovementId: history.conditionInMovementId,
          inventoryOutMovementId: history.inventoryOutMovementId,
          noReturnReason: dto.noReturnReason || null,
        });
      }
    }

    if (costPurposeOverridden) {
      await this.audit.log(userId, 'COST_PURPOSE_OVERRIDE', 'MaintenanceRequestRequiredPart', lineId, {
        sourceDefaultPurpose: MAINTENANCE_COST_PURPOSE,
        finalPurpose: costPurpose,
        overrideReason: costPurposeOverrideReason,
        sourceDocument: 'MAINTENANCE_PART_LINE',
        sourceLineId: lineId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        maintenanceRequestId: requestId,
      });
    }

    return this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true,
          technicalClassification: true, usageType: true, nature: true, importance: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        lastIssueBy: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Exact bounded transient-transaction retry convention established by R1D.
   * Only Prisma P2034 is retried; domain and uniqueness failures propagate.
   * The entire atomic maintenance issue transaction is retried, preventing a
   * partial or duplicate movement when the shared numbering counter conflicts.
   */
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

  async returnStock(requestId: string, lineId: string, dto: ReturnStockDto, userId: string, ctx: ActiveOperationalContext) {
    const part: any = await this.findPartLineOrFail(lineId, requestId, ctx);
    const currentIssued = part.issuedQuantity || 0;
    const currentReturned = part.returnedQuantity || 0;
    const netIssued = currentIssued - currentReturned;

    if (netIssued <= 0) {
      throw new BadRequestException('No issued stock to return');
    }
    if (dto.returnQuantity > netIssued) {
      throw new BadRequestException(`Return quantity ${dto.returnQuantity} exceeds net issued quantity ${netIssued}`);
    }

    const productId = part.sparePart.productId;
    if (!productId) {
      throw new BadRequestException('Spare part has no linked product');
    }

    const partLine = await this.prisma.maintenanceRequestRequiredPart.findUnique({ where: { id: lineId } });
    const warehouseId = partLine?.warehouseId;
    if (!warehouseId) {
      throw new BadRequestException('Part line has no warehouse assigned. Issue stock first.');
    }

    await assertWarehouseInContext(this.prisma, warehouseId, ctx);

    const companyId = ctx.companyId;
    const branchId = ctx.branchId;

    const movement = await this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

      // VAL-R1C: maintenance spare-part return (true-return) is blocked while the
      // warehouse has an ACTIVE valuation policy (deferred to VAL-R1D).
      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, ctx.companyId, warehouseId);
      if (activePolicy) {
        throw new BadRequestException({
          messageKey: 'inventoryValuation.unsupportedActiveFlow',
          message: 'Maintenance stock return is blocked while an ACTIVE valuation policy exists for the warehouse',
        });
      }
      await assertMachineTenantInContext(tx, part.maintenanceRequest.machine.id, ctx);
      await assertWarehouseInContext(tx, warehouseId, ctx);
      const balance = await this.getOrCreateBalance(tx, warehouseId, productId, null);
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: balance.quantity + dto.returnQuantity },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          movementNumber,
          companyId,
          branchId,
          warehouseId,
          movementType: 'MAINTENANCE_RETURN',
          status: 'POSTED',
          sourceType: 'MAINTENANCE_PART_LINE',
          sourceId: lineId,
          movementDate: new Date(),
          postedAt: new Date(),
          createdById: userId,
          postedById: userId,
          notes: dto.notes || null,
          lines: {
            create: [{
              productId,
              quantity: dto.returnQuantity,
              direction: 'IN',
              notes: `Maintenance stock return for spare part ${part.sparePart.code} - ${part.sparePart.name}`,
            }],
          },
        },
        include: { lines: true },
      });

      const newReturned = currentReturned + dto.returnQuantity;
      const approvableQty = part.approvedQuantity || part.requestedQuantity || part.quantity;
      const newStatus = this.computeIssueStatus(currentIssued, newReturned, approvableQty);

      await tx.maintenanceRequestRequiredPart.update({
        where: { id: lineId },
        data: {
          returnedQuantity: newReturned,
          stockIssueStatus: newStatus,
        },
      });

      return movement;
    });

    await this.audit.log(userId, 'RETURN_STOCK', 'MaintenanceRequestRequiredPart', lineId, {
      movementId: movement.id,
      movementNumber: movement.movementNumber,
      returnQuantity: dto.returnQuantity,
      warehouseId,
      productId,
    });

    return this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true,
          technicalClassification: true, usageType: true, nature: true, importance: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async getIssues(lineId: string, requestId: string, ctx: ActiveOperationalContext) {
    await this.findPartLineOrFail(lineId, requestId, ctx);
    return this.prisma.inventoryMovement.findMany({
      where: {
        sourceType: 'MAINTENANCE_PART_LINE',
        sourceId: lineId,
        companyId: ctx.companyId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
        deletedAt: null,
      },
      include: {
        lines: {
          include: { product: { select: { id: true, code: true, name: true } } },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOrCreateBalance(tx: any, warehouseId: string, productId: string, locationId: string | null | undefined) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    let balance = await tx.inventoryBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: { warehouseId, productId, locationId: locationId || null, quantity: 0 },
      });
    }
    return balance;
  }

  private async recordConditionMovementInTx(tx: any, data: {
    sparePartId: string;
    productId: string | null;
    warehouseId: string;
    condition: string;
    direction: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    maintenanceRequestId: string;
    requiredPartId: string;
    inventoryMovementId: string;
    replacementAction?: string;
    notes: string;
  }, userId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(tx, data.warehouseId, ctx);
    const balanceKey = { sparePartId: data.sparePartId, warehouseId: data.warehouseId, condition: data.condition };
    let balance = await tx.sparePartConditionBalance.findFirst({
      where: { sparePartKey: balanceKey.sparePartId, warehouseKey: balanceKey.warehouseId, condition: balanceKey.condition },
    });
    if (!balance) {
      balance = await tx.sparePartConditionBalance.create({
        data: {
          sparePartId: balanceKey.sparePartId,
          sparePartKey: balanceKey.sparePartId,
          productId: data.productId || null,
          warehouseId: balanceKey.warehouseId,
          warehouseKey: balanceKey.warehouseId,
          condition: balanceKey.condition,
          quantity: 0,
          availableQuantity: 0,
        },
      });
    }

    const delta = data.direction === 'IN' ? data.quantity : -data.quantity;
    const newQuantity = balance.quantity + delta;
    const newAvailable = balance.availableQuantity + delta;

    if (newQuantity < 0 || newAvailable < 0) {
      const sparePart = await tx.sparePart.findUnique({ where: { id: data.sparePartId } });
      throw new BadRequestException(
        `Insufficient condition balance for spare part ${sparePart?.name || data.sparePartId}. Available: ${balance.quantity}, Requested: ${data.quantity}`,
      );
    }

    await tx.sparePartConditionBalance.update({
      where: { id: balance.id },
      data: {
        quantity: newQuantity,
        availableQuantity: newAvailable,
        lastMovementAt: new Date(),
        productId: data.productId || balance.productId,
      },
    });

    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('SPARE_PART_CONDITION_MOVEMENT', tx);

    return tx.sparePartConditionMovement.create({
      data: {
        movementNumber,
        sparePartId: data.sparePartId,
        productId: data.productId || null,
        warehouseId: data.warehouseId,
        condition: data.condition,
        direction: data.direction,
        quantity: data.quantity,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        inventoryMovementId: data.inventoryMovementId,
        replacementAction: data.replacementAction || null,
        notes: data.notes || null,
        createdByUserId: userId,
      },
    });
  }
}
