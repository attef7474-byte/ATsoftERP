import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  PRODUCT_VERDICT_EXACT_DUPLICATE,
  PRODUCT_VERDICT_REVIEW_REQUIRED,
  evaluateProductCanonicalIdentity,
} from '../../../common/canonical-identity/canonical-product-identity';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private auditService: AuditService,
  ) {}

  /**
   * R4P TASK 5 + TASK 16: existing-Product duplicate control and audit coverage.
   *
   * Previously create() compared only the code and wrote no audit event at all,
   * so a duplicate inventory item could be created silently and a new Product was
   * the one catalog mutation with no accountability trail. Both are corrected here.
   *
   * Duplicate detection runs BEFORE the row is written and reuses the existing
   * Product instead of creating a second representation of one inventory item.
   */
  async create(dto: CreateProductDto, userId?: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('PRODUCT');
    const existing = await this.prisma.product.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Product code already exists');

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoProductDuplicate(tx, { code, barcode: dto.barcode });

      const product = await tx.product.create({ data: { ...dto, code } });
      await this.auditService.logWithClient(tx, {
        userId,
        action: 'CREATE',
        entity: 'Product',
        entityId: product.id,
        details: { message: `Created product: ${product.code}`, code: product.code },
      });
      return product;
    });
  }

  private async assertNoProductDuplicate(tx: any, identity: { code?: string | null; barcode?: string | null; qrCode?: string | null }, excludeProductId?: string) {
    const candidates = await tx.product.findMany({
      where: {
        deletedAt: null,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        OR: [
          ...(identity.code ? [{ code: identity.code }] : []),
          ...(identity.barcode ? [{ barcode: identity.barcode }] : []),
          ...(identity.qrCode ? [{ qrCode: identity.qrCode }] : []),
        ],
      },
      select: { id: true, code: true, name: true, barcode: true, qrCode: true },
    });

    if (candidates.length === 0) return;
    const decision = evaluateProductCanonicalIdentity(identity, candidates);

    if (decision.verdict === PRODUCT_VERDICT_EXACT_DUPLICATE) {
      const match = decision.matches[0];
      throw new ConflictException({
        message: decision.reason,
        error: 'PRODUCT_EXISTS',
        existingProductId: match.id,
        existingProductCode: match.code,
        identityBasis: decision.basisLabel,
      });
    }

    if (decision.verdict === PRODUCT_VERDICT_REVIEW_REQUIRED) {
      throw new ConflictException({
        message: decision.reason,
        error: 'PRODUCT_REVIEW_REQUIRED',
        candidates: decision.matches.map((m) => ({ id: m.id, code: m.code })),
        identityBasis: decision.basisLabel,
      });
    }
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

  async update(id: string, dto: UpdateProductDto, userId?: string) {
    const existing = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      // Re-check identity against the merged state so a partial edit cannot
      // introduce a second representation of the same inventory item.
      await this.assertNoProductDuplicate(
        tx,
        {
          code: existing.code,
          barcode: 'barcode' in dto ? (dto.barcode ?? null) : ((existing.barcode as string | null) ?? null),
        },
        id,
      );
      const product = await tx.product.update({ where: { id }, data: dto });
      await this.auditService.logWithClient(tx, {
        userId,
        action: 'UPDATE',
        entity: 'Product',
        entityId: id,
        details: { message: `Updated product: ${product.code}`, code: product.code },
      });
      return product;
    });
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);
    // R4P TASK 6: a Product that holds warehouse stock, backs a live spare part,
    // or appears in inventory history cannot be deleted. Stock must be moved or
    // written off through a real inventory transaction first, never by removing
    // the catalog row that the balance points at.
    const balanceCount = await this.prisma.inventoryBalance.count({ where: { productId: id } });
    if (balanceCount > 0) throw new ConflictException('Cannot delete product that holds warehouse stock');
    const sparePartCount = await this.prisma.sparePart.count({ where: { productId: id, deletedAt: null } });
    if (sparePartCount > 0) throw new ConflictException('Cannot delete product that represents an active spare part');
    const movementCount = await this.prisma.inventoryMovementLine.count({ where: { productId: id } });
    if (movementCount > 0) throw new ConflictException('Cannot delete product with inventory movement history');

    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'Product', id, { message: `Deleted product: ${existing.code}` });
    return { message: 'Product deleted successfully' };
  }

  async activate(id: string, userId?: string) {
    await this.findOne(id);
    const product = await this.prisma.product.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'Product', id, { message: `Activated product: ${product.code}` });
    return product;
  }

  async deactivate(id: string, userId?: string) {
    await this.findOne(id);
    const product = await this.prisma.product.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'Product', id, { message: `Deactivated product: ${product.code}` });
    return product;
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
