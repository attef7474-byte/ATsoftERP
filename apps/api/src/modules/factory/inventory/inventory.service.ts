import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async createWarehouse(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId: dto.companyId, code: dto.code },
    });
    if (existing) throw new ConflictException('Warehouse code already exists in this company');
    return this.prisma.warehouse.create({ data: dto });
  }

  async findAllWarehouses(query: { page?: number; limit?: number; search?: string; companyId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) where.name = { contains: query.search };
    if (query.companyId) where.companyId = query.companyId;

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } }, _count: { select: { locations: true, balances: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        locations: { where: { status: 'ACTIVE' } },
      },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    await this.findOneWarehouse(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async removeWarehouse(id: string) {
    await this.findOneWarehouse(id);
    await this.prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Warehouse deleted successfully' };
  }

  async createLocation(dto: CreateWarehouseLocationDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return this.prisma.warehouseLocation.create({ data: dto });
  }

  async findLocations(warehouseId: string) {
    return this.prisma.warehouseLocation.findMany({
      where: { warehouseId, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
    });
  }

  async updateLocation(id: string, dto: UpdateWarehouseLocationDto) {
    const location = await this.prisma.warehouseLocation.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return this.prisma.warehouseLocation.update({ where: { id }, data: dto });
  }

  async removeLocation(id: string) {
    const location = await this.prisma.warehouseLocation.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return this.prisma.warehouseLocation.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async adjustStock(dto: CreateStockAdjustmentDto) {
    const existing = await this.prisma.inventoryBalance.findFirst({
      where: {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        locationId: dto.locationId || null,
      },
    });

    if (existing) {
      return this.prisma.inventoryBalance.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + dto.quantity },
      });
    }

    return this.prisma.inventoryBalance.create({
      data: {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        locationId: dto.locationId,
        quantity: dto.quantity,
      },
    });
  }

  async getBalances(query: { warehouseId?: string; productId?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          product: { select: { id: true, name: true, code: true, unit: true } },
          location: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
