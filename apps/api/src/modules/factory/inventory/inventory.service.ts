import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
  ) {}

  async createWarehouse(dto: CreateWarehouseDto, ctx: ActiveOperationalContext) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('WAREHOUSE');
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId: ctx.companyId, code },
    });
    if (existing) throw new ConflictException('Warehouse code already exists in this company');
    return this.prisma.warehouse.create({ data: { ...dto, code, companyId: ctx.companyId, branchId: ctx.branchId } });
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
    if (query.search) where.name = { contains: query.search };
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

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, ctx: ActiveOperationalContext) {
    await this.findOneWarehouse(id, ctx);
    const { companyId: _companyId, branchId: _branchId, ...data } = dto;
    return this.prisma.warehouse.update({ where: { id }, data });
  }

  async removeWarehouse(id: string, ctx: ActiveOperationalContext) {
    await this.findOneWarehouse(id, ctx);
    await this.prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Warehouse deleted successfully' };
  }

  async createLocation(dto: CreateWarehouseLocationDto, ctx: ActiveOperationalContext) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    assertRowInContext(warehouse, ctx, 'warehouse');
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('WAREHOUSE_LOCATION');
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { warehouseId: dto.warehouseId, code },
    });
    if (existing) throw new ConflictException('Location code already exists in this warehouse');
    return this.prisma.warehouseLocation.create({
      data: { ...dto, code },
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
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

  async updateLocation(id: string, dto: UpdateWarehouseLocationDto, ctx: ActiveOperationalContext) {
    const location = await this.findOneLocation(id, ctx);
    if (dto.warehouseId) {
      await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    }
    return this.prisma.warehouseLocation.update({
      where: { id },
      data: dto,
      include: { warehouse: { select: { id: true, name: true, code: true } } },
    });
  }

  async removeLocation(id: string, ctx: ActiveOperationalContext) {
    const location = await this.findOneLocation(id, ctx);
    return this.prisma.warehouseLocation.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async activateLocation(id: string, ctx: ActiveOperationalContext) {
    const location = await this.findOneLocation(id, ctx);
    return this.prisma.warehouseLocation.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async activateWarehouse(id: string, ctx: ActiveOperationalContext) {
    const wh = await this.findOneWarehouse(id, ctx);
    return this.prisma.warehouse.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async deactivateWarehouse(id: string, ctx: ActiveOperationalContext) {
    const wh = await this.findOneWarehouse(id, ctx);
    return this.prisma.warehouse.update({ where: { id }, data: { status: 'INACTIVE' } });
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
