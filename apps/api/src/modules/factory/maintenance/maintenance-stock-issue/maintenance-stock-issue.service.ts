import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { IssueStockDto, ReturnStockDto } from './dto/issue-stock.dto';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';

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
  ) {}

  private async findPartLineOrFail(lineId: string, requestId: string) {
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
    return part as any;
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

  async issue(requestId: string, lineId: string, dto: IssueStockDto, userId: string) {
    const part: any = await this.findPartLineOrFail(lineId, requestId);
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

    const companyId = machine.companyId;
    const branchId = machine.branchId;

    const movement = await this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

      const balance = await this.getOrCreateBalance(tx, dto.warehouseId, productId, dto.warehouseLocationId);
      const delta = -dto.issuedQuantity;
      const newQuantity = balance.quantity + delta;

      if (newQuantity < 0) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        throw new BadRequestException(
          `Insufficient stock for product ${product?.name || productId}. Available: ${balance.quantity}, Requested: ${dto.issuedQuantity}`,
        );
      }

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity },
      });

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

      const newIssued = (part.issuedQuantity || 0) + dto.issuedQuantity;
      const newStatus = this.computeIssueStatus(newIssued, currentReturned, approvableQty);

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
      }, userId);
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
        }, userId);
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
    });

    await this.audit.log(userId, 'ISSUE_STOCK', 'MaintenanceRequestRequiredPart', lineId, {
      movementId: movement.id,
      movementNumber: movement.movementNumber,
      issuedQuantity: dto.issuedQuantity,
      warehouseId: dto.warehouseId,
      productId,
      replacementAction: dto.replacementAction,
      issuedStockCondition: dto.issuedStockCondition,
    });

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

  async returnStock(requestId: string, lineId: string, dto: ReturnStockDto, userId: string) {
    const part: any = await this.findPartLineOrFail(lineId, requestId);
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

    const companyId = part.maintenanceRequest.machine.companyId;
    const branchId = part.maintenanceRequest.machine.branchId;

    const movement = await this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

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

  async getIssues(lineId: string, requestId: string) {
    await this.findPartLineOrFail(lineId, requestId);
    return this.prisma.inventoryMovement.findMany({
      where: {
        sourceType: 'MAINTENANCE_PART_LINE',
        sourceId: lineId,
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
  }, userId: string) {
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

    const movementNumber = await this.numberingService.generateNumberAtomic('SPARE_PART_CONDITION_MOVEMENT');

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
