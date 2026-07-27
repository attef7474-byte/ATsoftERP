import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { IssueStockDto, ReturnStockDto } from './dto/issue-stock.dto';

@Injectable()
export class MaintenanceStockIssueService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async findPartLineOrFail(lineId: string, requestId: string) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        maintenanceRequest: { include: { machine: { select: { id: true, companyId: true, branchId: true } } } },
        sparePart: { select: { id: true, productId: true, code: true, name: true } },
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

  async issue(requestId: string, lineId: string, dto: IssueStockDto, userId: string) {
    const part: any = await this.findPartLineOrFail(lineId, requestId);
    if (!['APPROVED', 'RESERVED'].includes(part.status)) {
      throw new BadRequestException(`Cannot issue stock for part in status '${part.status}'. Must be APPROVED or RESERVED`);
    }

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

    const companyId = part.maintenanceRequest.machine.companyId;
    const branchId = part.maintenanceRequest.machine.branchId;

    const movement = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
      if (!seq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const movementNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

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

      await tx.maintenanceRequestRequiredPart.update({
        where: { id: lineId },
        data: {
          issuedQuantity: newIssued,
          stockIssueStatus: newStatus,
          warehouseId: dto.warehouseId,
          lastIssueAt: new Date(),
          lastIssueByUserId: userId,
        },
      });

      return movement;
    });

    await this.audit.log(userId, 'ISSUE_STOCK', 'MaintenanceRequestRequiredPart', lineId, {
      movementId: movement.id,
      movementNumber: movement.movementNumber,
      issuedQuantity: dto.issuedQuantity,
      warehouseId: dto.warehouseId,
      productId,
    });

    return this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
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
      const seq = await tx.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
      if (!seq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const movementNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

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
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
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
}
