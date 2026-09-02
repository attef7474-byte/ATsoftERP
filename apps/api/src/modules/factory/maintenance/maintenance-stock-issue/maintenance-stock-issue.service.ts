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

  private validateReplacementAction(dto: IssueStockDto) {
    if (!dto.replacementAction) {
      throw new BadRequestException('replacementAction is required (RETURNED_REMOVED_PART, NO_REMOVED_PART, or NEW_INSTALLATION)');
    }
    if (!VALID_REPLACEMENT_ACTIONS.includes(dto.replacementAction)) {
      throw new BadRequestException(`Invalid replacementAction '${dto.replacementAction}'. Must be one of: ${VALID_REPLACEMENT_ACTIONS.join(', ')}`);
    }
    if (dto.replacementAction === 'RETURNED_REMOVED_PART') {
      if (!dto.removedPartCondition) throw new BadRequestException('removedPartCondition is required when replacementAction is RETURNED_REMOVED_PART');
      if (!dto.removedPartWarehouseId) throw new BadRequestException('removedPartWarehouseId is required when replacementAction is RETURNED_REMOVED_PART');
      if (!dto.removedPartQuantity || dto.removedPartQuantity <= 0) throw new BadRequestException('removedPartQuantity (positive) is required when replacementAction is RETURNED_REMOVED_PART');
      if (!VALID_STOCK_CONDITIONS.includes(dto.removedPartCondition)) {
        throw new BadRequestException(`Invalid removedPartCondition '${dto.removedPartCondition}'`);
      }
    }
    if (dto.replacementAction === 'NO_REMOVED_PART') {
      if (!dto.noReturnReason) throw new BadRequestException('noReturnReason is required when replacementAction is NO_REMOVED_PART');
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

      // Removed part fields
      if (dto.removedPartCondition) costData.removedPartCondition = dto.removedPartCondition;
      if (dto.removedPartWarehouseId) costData.removedPartWarehouseId = dto.removedPartWarehouseId;
      if (dto.removedPartQuantity != null) costData.removedPartQuantity = dto.removedPartQuantity;
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

      // Record condition OUT for issued part
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

      // If removed part returned, record condition IN
      let conditionInMovementId: string | null = null;
      if (dto.replacementAction === 'RETURNED_REMOVED_PART' && dto.removedPartCondition && dto.removedPartWarehouseId && dto.removedPartQuantity) {
        const inMovement = await this.recordConditionMovementInTx(tx, {
          sparePartId: part.sparePart.id,
          productId,
          warehouseId: dto.removedPartWarehouseId,
          condition: dto.removedPartCondition,
          direction: 'IN',
          quantity: dto.removedPartQuantity,
          sourceType: 'MAINTENANCE_REMOVED_PART_RETURN',
          sourceId: lineId,
          maintenanceRequestId: requestId,
          requiredPartId: lineId,
          inventoryMovementId: movement.id,
          replacementAction: dto.replacementAction,
          notes: `Returned removed part ${part.sparePart.code} (condition: ${dto.removedPartCondition}, qty: ${dto.removedPartQuantity})`,
        }, userId, ctx);
        if (inMovement) conditionInMovementId = inMovement.id;
      }

      // Record installed part
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

      // Record replacement history when replacing an existing part
      if (dto.replacementAction && dto.replacementAction !== 'NEW_INSTALLATION') {
        await this.installedPartsService.recordReplacementInTx(tx, {
          machineId: part.maintenanceRequest.machine.id,
          machineComponentId: part.machineComponent?.id || null,
          maintenanceRequestId: requestId,
          requiredPartId: lineId,
          newInstalledPartId: installedPart.id,
          newSparePartId: part.sparePart.id,
          issuedCondition,
          issuedQuantity: dto.issuedQuantity,
          removedCondition: dto.removedPartCondition || null,
          removedQuantity: dto.removedPartQuantity || null,
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
    }));

    await this.audit.log(userId, 'ISSUE_STOCK', 'MaintenanceRequestRequiredPart', lineId, {
      movementId: movement.id,
      movementNumber: movement.movementNumber,
      issuedQuantity: dto.issuedQuantity,
      warehouseId: dto.warehouseId,
      productId,
      replacementAction: dto.replacementAction,
      issuedStockCondition: dto.issuedStockCondition,
    });

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
      where: { sparePartId: balanceKey.sparePartId, warehouseId: balanceKey.warehouseId, condition: balanceKey.condition },
    });
    if (!balance) {
      balance = await tx.sparePartConditionBalance.create({
        data: {
          sparePartId: balanceKey.sparePartId,
          productId: data.productId || null,
          warehouseId: balanceKey.warehouseId,
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
