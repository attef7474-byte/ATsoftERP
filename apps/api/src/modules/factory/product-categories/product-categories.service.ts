import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Category code already exists');
    return this.prisma.productCategory.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.productCategory.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { parent: { select: { id: true, name: true } }, _count: { select: { children: true, products: true } } },
      }),
      this.prisma.productCategory.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { products: true } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateProductCategoryDto) {
    await this.findOne(id);
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.productCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Category deleted successfully' };
  }

  async getTree() {
    const categories = await this.prisma.productCategory.findMany({
      where: { deletedAt: null },
      include: {
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } },
        _count: { select: { products: true } },
      },
    });
    return categories.filter((c) => !c.parentId);
  }
}
