import { Injectable, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';

const AUDIT_SCOPE = 'OPERATIONAL_INVENTORY_MASTER';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entity: 'Warehouse' | 'WarehouseLocation',
    entityId: string | undefined,
    ctx: ActiveOperationalContext,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown>,
    reason?: string,
  ) {
    if (!userId) return;
    await this.auditWriter().log(userId, action, entity, entityId, {
      schemaVersion: 1,
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous,
      next,
      ...(reason ? { reason } : {}),
    });
  }

  private warehouseSnapshot(warehouse: any) {
    return {
      code: warehouse.code,
      name: warehouse.name,
      warehouseType: warehouse.warehouseType ?? null,
      status: warehouse.status ?? null,
      deletedAt: warehouse.deletedAt ?? null,
      branchId: warehouse.branchId ?? null,
    };
  }

  private locationSnapshot(location: any) {
    return {
      code: location.code,
      name: location.name,
      status: location.status ?? null,
      warehouseId: location.warehouseId,
    };
  }

  async createWarehouse(dto: CreateWarehouseDto, ctx: ActiveOperationalContext, userId?: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('WAREHOUSE');
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId: ctx.companyId, code },
    });
    if (existing) throw new ConflictException('Warehouse code already exists in this company');
    const created = await this.prisma.warehouse.create({ data: { ...dto, code, companyId: ctx.companyId, branchId: ctx.branchId } });
    await this.auditWrite(userId, 'CREATE', 'Warehouse', created.id, ctx, null, this.warehouseSnapshot(created));
    return created;
  }

  async findAllWarehouses(query: { page?: number; limit?: number; search?: string; companyId?: string; warehouseType?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
    if (query.search) {
      // The warehouse lookup adapter (warehouseAdapter) advertises
      // searchFields ['code', 'name'], so both must match. The company/branch
      // scope above already occupies the top-level `OR`, therefore the search
      // predicate is added as a separate AND-ed group instead of overwriting it.
      where.AND = [
        {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
          ],
        },
      ];
    }
    if (query.warehouseType) where.warehouseType = query.warehouseType;

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } }, _count: { select: { locations: true, balances: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneWarehouse(id: string, ctx: ActiveOperationalContext) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        locations: { where: { status: 'ACTIVE' } },
      },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    assertRowInContext(warehouse, ctx, 'warehouse');
    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneWarehouse(id, ctx);
    const { companyId: _companyId, branchId: _branchId, ...data } = dto;
    const updated = await this.prisma.warehouse.update({ where: { id }, data });
    await this.auditWrite(userId, 'UPDATE', 'Warehouse', id, ctx, this.warehouseSnapshot(before), this.warehouseSnapshot(updated), 'WAREHOUSE_UPDATE');
    return updated;
  }

  async removeWarehouse(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneWarehouse(id, ctx);
    const deletedAt = new Date();
    await this.prisma.warehouse.update({ where: { id }, data: { deletedAt } });
    await this.auditWrite(
      userId,
      'DELETE',
      'Warehouse',
      id,
      ctx,
      this.warehouseSnapshot(before),
      { ...this.warehouseSnapshot(before), deletedAt: deletedAt.toISOString() },
      'SOFT_DELETE',
    );
    return { message: 'Warehouse deleted successfully' };
  }

  async createLocation(dto: CreateWarehouseLocationDto, ctx: ActiveOperationalContext, userId?: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    assertRowInContext(warehouse, ctx, 'warehouse');
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('WAREHOUSE_LOCATION');
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { warehouseId: dto.warehouseId, code },
    });
    if (existing) throw new ConflictException('Location code already exists in this warehouse');
    const created = await this.prisma.warehouseLocation.create({
      data: { ...dto, code },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
    await this.auditWrite(userId, 'CREATE', 'WarehouseLocation', created.id, ctx, null, this.locationSnapshot(created));
    return created;
  }

  async findAllLocations(query: { page?: number; limit?: number; search?: string; warehouseId?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouse: {
        companyId: ctx.companyId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    };
    if (query.warehouseId) {
      await assertWarehouseInContext(this.prisma, query.warehouseId, ctx);
      where.warehouseId = query.warehouseId;
    }
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.warehouseLocation.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { warehouse: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.warehouseLocation.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneLocation(id: string, ctx: ActiveOperationalContext) {
    const location = await this.prisma.warehouseLocation.findUnique({
      where: { id },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
    if (!location) throw new NotFoundException('Location not found');
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: location.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    assertRowInContext(warehouse, ctx, 'warehouse');
    return location;
  }

  async findLocations(warehouseId: string, ctx: ActiveOperationalContext) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    assertRowInContext(warehouse, ctx, 'warehouse');
    return this.prisma.warehouseLocation.findMany({
      where: { warehouseId, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
  }

  async updateLocation(id: string, dto: UpdateWarehouseLocationDto, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneLocation(id, ctx);
    if (dto.warehouseId) {
      await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    }
    const updated = await this.prisma.warehouseLocation.update({
      where: { id },
      data: dto,
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
    await this.auditWrite(userId, 'UPDATE', 'WarehouseLocation', id, ctx, this.locationSnapshot(before), this.locationSnapshot(updated), 'LOCATION_UPDATE');
    return updated;
  }

  async removeLocation(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneLocation(id, ctx);
    const updated = await this.prisma.warehouseLocation.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    await this.auditWrite(userId, 'DEACTIVATE', 'WarehouseLocation', id, ctx, this.locationSnapshot(before), this.locationSnapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async activateLocation(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneLocation(id, ctx);
    const updated = await this.prisma.warehouseLocation.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.auditWrite(userId, 'ACTIVATE', 'WarehouseLocation', id, ctx, this.locationSnapshot(before), this.locationSnapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async activateWarehouse(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneWarehouse(id, ctx);
    const updated = await this.prisma.warehouse.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditWrite(userId, 'ACTIVATE', 'Warehouse', id, ctx, this.warehouseSnapshot(before), this.warehouseSnapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async deactivateWarehouse(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const before = await this.findOneWarehouse(id, ctx);
    const updated = await this.prisma.warehouse.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditWrite(userId, 'DEACTIVATE', 'Warehouse', id, ctx, this.warehouseSnapshot(before), this.warehouseSnapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async warehouseSummary(id: string, ctx: ActiveOperationalContext) {
    const wh = await this.findOneWarehouse(id, ctx);
    const [locationCount, balanceCount, balanceAgg] = await Promise.all([
      this.prisma.warehouseLocation.count({ where: { warehouseId: id, status: 'ACTIVE' } }),
      this.prisma.inventoryBalance.count({ where: { warehouseId: id } }),
      this.prisma.inventoryBalance.aggregate({ where: { warehouseId: id }, _sum: { quantity: true } }),
    ]);
    return { warehouse: wh, locationCount, balanceCount, totalQuantity: balanceAgg._sum.quantity || 0 };
  }

  async locationBalances(id: string, ctx: ActiveOperationalContext) {
    const loc = await this.findOneLocation(id, ctx);
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { locationId: id },
      include: { product: { select: { id: true, code: true, name: true, unit: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return { location: loc, balances };
  }
}
