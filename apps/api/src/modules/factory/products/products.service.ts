import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Product code already exists');
    return this.prisma.product.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; categoryId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { barcode: { contains: query.search } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { category: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, code: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Product deleted successfully' };
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async balances(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryBalance.findMany({
      where: { productId: id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async movements(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryMovementLine.findMany({
      where: { productId: id },
      include: {
        movement: {
          select: { id: true, movementNumber: true, movementType: true, status: true, movementDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countHistory(id: string) {
    await this.findOne(id);
    return this.prisma.inventoryCountLine.findMany({
      where: { productId: id },
      include: {
        count: {
          select: { id: true, countNumber: true, status: true, countDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
