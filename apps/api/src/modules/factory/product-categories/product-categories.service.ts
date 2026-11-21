import { Injectable, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

const AUDIT_ENTITY = 'ProductCategory';
const AUDIT_SCOPE = 'GLOBAL_PRODUCT_CATEGORY_CATALOG';

@Injectable()
export class ProductCategoriesService {
  // AuditService is the single audit unit. @Optional keeps direct unit-test
  // construction working; every authenticated controller write supplies an actor.
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entityId: string | undefined,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown>,
    reason?: string,
  ) {
    if (!userId) return;
    await this.auditWriter().log(userId, action, AUDIT_ENTITY, entityId, {
      schemaVersion: 1,
      companyId: null,
      branchId: null,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous,
      next,
      ...(reason ? { reason } : {}),
    });
  }

  private snapshot(category: any) {
    return {
      code: category.code,
      name: category.name,
      description: category.description ?? null,
      parentId: category.parentId ?? null,
      status: category.status,
      deletedAt: category.deletedAt ?? null,
    };
  }

  async create(dto: CreateProductCategoryDto, userId?: string) {
    const existing = await this.prisma.productCategory.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Category code already exists');
    const created = await this.prisma.productCategory.create({ data: dto });
    await this.auditWrite(userId, 'CREATE', created.id, null, this.snapshot(created));
    return created;
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

  async update(id: string, dto: UpdateProductCategoryDto, userId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.productCategory.update({ where: { id }, data: dto });
    await this.auditWrite(userId, 'UPDATE', id, this.snapshot(before), this.snapshot(updated), 'CATEGORY_UPDATE');
    return updated;
  }

  async remove(id: string, userId?: string) {
    const before = await this.findOne(id);
    const deletedAt = new Date();
    await this.prisma.productCategory.update({ where: { id }, data: { deletedAt } });
    await this.auditWrite(
      userId,
      'DELETE',
      id,
      this.snapshot(before),
      { ...this.snapshot(before), deletedAt: deletedAt.toISOString() },
      'SOFT_DELETE',
    );
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

  async activate(id: string, userId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.productCategory.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditWrite(userId, 'ACTIVATE', id, this.snapshot(before), this.snapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async deactivate(id: string, userId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.productCategory.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditWrite(userId, 'DEACTIVATE', id, this.snapshot(before), this.snapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }
}
