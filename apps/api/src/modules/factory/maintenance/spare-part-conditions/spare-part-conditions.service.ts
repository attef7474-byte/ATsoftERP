import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import {
  RecordConditionMovementDto,
  QueryConditionBalanceDto,
  QueryConditionMovementDto,
} from './dto/condition-movement.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import {
  assertRowInContext,
  assertWarehouseInContext,
  assertMaintenanceRequestInContext,
} from '../../../../common/operational-context/tenant-guards';

const VALID_CONDITIONS = ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'];
const VALID_DIRECTIONS = ['IN', 'OUT'];

interface BalanceKey {
  sparePartId: string;
  warehouseId: string;
  condition: string;
}

@Injectable()
export class SparePartConditionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private warehouseWhere(ctx: ActiveOperationalContext): any {
    return {
      warehouse: {
        companyId: ctx.companyId,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    };
  }

  // ── Balance Queries ──────────────────────────────────────────────

  async getBalances(query: QueryConditionBalanceDto, ctx: ActiveOperationalContext) {
    const where: any = this.warehouseWhere(ctx);
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.condition) where.condition = query.condition;
    if (query.minQuantity != null) where.quantity = { gte: query.minQuantity };
    if (query.availableOnly === 'true') where.availableQuantity = { gt: 0 };

    return this.prisma.sparePartConditionBalance.findMany({
      where,
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true, technicalClassification: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getBalanceById(id: string, ctx: ActiveOperationalContext) {
    const balance = await this.prisma.sparePartConditionBalance.findUnique({
      where: { id },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true, companyId: true, branchId: true } },
      },
    });
    if (!balance) throw new NotFoundException('Condition balance not found');
    assertRowInContext(balance.warehouse, ctx, 'condition balance');
    return balance;
  }

  async getBalanceByKey(sparePartId: string, warehouseId: string, condition: string) {
    const balance = await this.prisma.sparePartConditionBalance.findFirst({
      where: { sparePartId, warehouseId, condition },
    });
    if (!balance) throw new NotFoundException('stock.conditionBalanceNotFound');
    return balance;
  }

  async getBalancesBySparePart(sparePartId: string, ctx: ActiveOperationalContext) {
    return this.prisma.sparePartConditionBalance.findMany({
      where: { sparePartId, ...this.warehouseWhere(ctx) },
      include: {
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
      },
      orderBy: [{ condition: 'asc' }, { availableQuantity: 'desc' }],
    });
  }

  async getBalancesByWarehouse(warehouseId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(this.prisma, warehouseId, ctx);
    return this.prisma.sparePartConditionBalance.findMany({
      where: { warehouseId },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
      },
      orderBy: [{ condition: 'asc' }, { availableQuantity: 'desc' }],
    });
  }

  // ── Movement Recording ───────────────────────────────────────────

  async recordMovement(dto: RecordConditionMovementDto, userId: string, ctx: ActiveOperationalContext) {
    if (!VALID_CONDITIONS.includes(dto.condition)) {
      throw new BadRequestException(`Invalid condition '${dto.condition}'`);
    }
    if (!VALID_DIRECTIONS.includes(dto.direction)) {
      throw new BadRequestException(`Invalid direction '${dto.direction}'. Must be IN or OUT`);
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const movementNumber = await this.numberingService.generateNumberAtomic('SPARE_PART_CONDITION_MOVEMENT');

    return this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      if (dto.maintenanceRequestId) {
        await assertMaintenanceRequestInContext(tx, dto.maintenanceRequestId, ctx);
      }
      if (dto.inventoryMovementId) {
        const movement = await tx.inventoryMovement.findUnique({ where: { id: dto.inventoryMovementId } });
        if (!movement || movement.companyId !== ctx.companyId) {
          throw new BadRequestException('Invalid inventory movement reference');
        }
      }

      const balance = await this.getOrCreateBalance(tx, {
        sparePartId: dto.sparePartId,
        warehouseId: dto.warehouseId,
        condition: dto.condition,
      }, dto.productId);

      const delta = dto.direction === 'IN' ? dto.quantity : -dto.quantity;
      const newQuantity = balance.quantity + delta;
      const newAvailable = balance.availableQuantity + delta;

      if (newQuantity < 0 || newAvailable < 0) {
        const sparePart = await tx.sparePart.findUnique({ where: { id: dto.sparePartId } });
        throw new BadRequestException(
          `Insufficient condition balance for spare part ${sparePart?.name || dto.sparePartId}. Available: ${balance.quantity}, Requested: ${dto.quantity}`,
        );
      }

      await tx.sparePartConditionBalance.update({
        where: { id: balance.id },
        data: {
          quantity: newQuantity,
          availableQuantity: newAvailable,
          lastMovementAt: new Date(),
          productId: dto.productId || balance.productId,
        },
      });

      const movement = await tx.sparePartConditionMovement.create({
        data: {
          movementNumber,
          sparePartId: dto.sparePartId,
          productId: dto.productId || null,
          warehouseId: dto.warehouseId,
          condition: dto.condition,
          direction: dto.direction,
          quantity: dto.quantity,
          sourceType: dto.sourceType || null,
          sourceId: dto.sourceId || null,
          maintenanceRequestId: dto.maintenanceRequestId || null,
          requiredPartId: dto.requiredPartId || null,
          inventoryMovementId: dto.inventoryMovementId || null,
          replacementAction: dto.replacementAction || null,
          notes: dto.notes || null,
          createdByUserId: userId,
        },
      });

      return movement;
    });
  }

  // ── Movement Queries ─────────────────────────────────────────────

  async getMovements(query: QueryConditionMovementDto, ctx: ActiveOperationalContext) {
    const where: any = this.warehouseWhere(ctx);
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.condition) where.condition = query.condition;
    if (query.direction) where.direction = query.direction;
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.requiredPartId) where.requiredPartId = query.requiredPartId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.fromDate) where.createdAt = { ...where.createdAt, gte: new Date(query.fromDate) };
    if (query.toDate) where.createdAt = { ...where.createdAt, lte: new Date(query.toDate) };
    if (query.limit) where.limit = query.limit;

    return this.prisma.sparePartConditionMovement.findMany({
      where,
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        requiredPart: { select: { id: true, quantity: true, requestedQuantity: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
    });
  }

  async getMovementById(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.prisma.sparePartConditionMovement.findUnique({
      where: { id },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true, companyId: true, branchId: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        requiredPart: { select: { id: true, quantity: true, requestedQuantity: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!movement) throw new NotFoundException('Condition movement not found');
    assertRowInContext(movement.warehouse, ctx, 'condition movement');
    return movement;
  }

  async getMovementsByRequiredPart(requiredPartId: string, ctx: ActiveOperationalContext) {
    return this.prisma.sparePartConditionMovement.findMany({
      where: { requiredPartId, ...this.warehouseWhere(ctx) },
      include: {
        sparePart: { select: { id: true, code: true, name: true, productId: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Internal Helpers ─────────────────────────────────────────────

  private async getOrCreateBalance(tx: any, key: BalanceKey, productId?: string | null) {
    const where = {
      sparePartId: key.sparePartId,
      warehouseId: key.warehouseId,
      condition: key.condition,
    };
    let balance = await tx.sparePartConditionBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.sparePartConditionBalance.create({
        data: {
          sparePartId: key.sparePartId,
          productId: productId || null,
          warehouseId: key.warehouseId,
          condition: key.condition,
          quantity: 0,
          availableQuantity: 0,
        },
      });
    }
    return balance;
  }
}
