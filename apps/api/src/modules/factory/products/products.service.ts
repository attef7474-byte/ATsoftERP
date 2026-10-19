import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductUomInputDto } from './dto/product-uom.dto';
import { ProductUomValidationError, buildProductUomPlan, ProductUomRowInput } from './product-uom.domain';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  PRODUCT_VERDICT_EXACT_DUPLICATE,
  PRODUCT_VERDICT_REVIEW_REQUIRED,
  evaluateProductCanonicalIdentity,
} from '../../../common/canonical-identity/canonical-product-identity';

const PRODUCT_UNIT_SELECT = { id: true, code: true, nameAr: true, nameEn: true, symbol: true } as const;

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, code: true } },
  unitRef: { select: PRODUCT_UNIT_SELECT },
  uoms: { include: { unit: { select: PRODUCT_UNIT_SELECT } }, orderBy: { createdAt: 'asc' } },
} as const;

const PRODUCTION_DEFINITION_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  companyId: true,
  branchId: true,
  defaultUnitId: true,
  defaultLineId: true,
  defaultWarehouseId: true,
  defaultCostCenterId: true,
} as const;

/**
 * Tenant/scope-filtered production configuration include. Reads only the
 * definition that belongs to the active (or archived) company/branch so a
 * product detail never leaks another branch's production configuration.
 */
function productionDefinitionInclude(ctx?: ActiveOperationalContext) {
  if (!ctx) return undefined;
  return {
    where: { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId },
    select: PRODUCTION_DEFINITION_SELECT,
    orderBy: { createdAt: 'asc' as const },
  };
}

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
   * Multi-UOM: a Product carries exactly one base inventory unit (resolved from
   * the global Unit master) plus optional packaging UOMs that resolve to that
   * base. The base inventory unit is the sole quantity authority.
   */
  async create(dto: CreateProductDto, userId?: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('PRODUCT');
    try {
      return await this.prisma.$transaction((tx) => this.createInTx(tx, dto, userId, code));
    } catch (error) {
      throw this.rethrowUomError(error);
    }
  }

  /** Resolved by the caller (aggregate) so one transaction owns the whole write. */
  async generateProductCode(): Promise<string> {
    return this.numberingService.generateNumberAtomic('PRODUCT');
  }

  /**
   * Transaction-aware create. Callers that also write a linked operational
   * record (e.g. the production configuration) pass their own `tx` so the whole
   * aggregate is atomic. The `production` block is never written here — it is
   * owned by the production definitions service.
   */
  async createInTx(tx: any, dto: CreateProductDto, userId?: string, resolvedCode?: string) {
    const code = resolvedCode?.trim() || dto.code?.trim() || await this.numberingService.generateNumberAtomic('PRODUCT');
    await this.assertNoProductDuplicate(tx, { code, barcode: dto.barcode });

    const base = await this.resolveBaseUnit(tx, { unitId: dto.unitId, unit: dto.unit });
    const rows = this.normalizeUomInput(dto.uoms, null);
    const plan = base.unitId ? buildProductUomPlan(rows, base.unitId) : [];
    if (plan.length) await this.assertUnitsExist(tx, plan.map((row) => row.unitId));

    const { uoms, unitId, production, ...scalars } = dto;
    const product = await tx.product.create({
      data: { ...scalars, code, unit: base.unitCode, unitId: base.unitId },
    });

    if (plan.length) await this.persistUomPlan(tx, product.id, plan);

    await this.auditService.logWithClient(tx, {
      userId,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      details: {
        message: `Created product: ${product.code}`,
        code: product.code,
        baseUnitId: base.unitId,
        packagingUomCount: Math.max(plan.length - 1, 0),
      },
    });
    return tx.product.findUnique({ where: { id: product.id }, include: PRODUCT_INCLUDE });
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

  /**
   * Resolves the Product base inventory unit from the global Unit master. A
   * free-text unit is accepted only when it exactly matches a Unit code; the
   * base unit may never be an unknown string.
   */
  private async resolveBaseUnit(tx: any, input: { unitId?: string; unit?: string }): Promise<{ unitId: string | null; unitCode: string }> {
    if (input.unitId) {
      const unit = await tx.unit.findUnique({ where: { id: input.unitId } });
      if (!unit) {
        throw new ProductUomValidationError('unitId', 'products.uomInvalidBaseUnit', 'The selected base unit does not exist in the global unit master.');
      }
      return { unitId: unit.id, unitCode: unit.code };
    }
    if (input.unit) {
      const code = input.unit.trim().toUpperCase();
      const unit = await tx.unit.findUnique({ where: { code } });
      if (!unit) {
        throw new ProductUomValidationError('unit', 'products.uomInvalidBaseUnit', 'The base unit must be selected from the global unit master.');
      }
      return { unitId: unit.id, unitCode: unit.code };
    }
    throw new ProductUomValidationError('unit', 'products.uomInvalidBaseUnit', 'A base inventory unit is required.');
  }

  private normalizeUomInput(
    rows: ProductUomInputDto[] | undefined,
    existingUnitByUomId: Map<string, string> | null,
  ): ProductUomRowInput[] {
    if (!rows || rows.length === 0) return [];
    return rows.map((row) => {
      let parentUnitId = row.parentUnitId ?? null;
      if (!parentUnitId && row.parentProductUomId) {
        if (!existingUnitByUomId || !existingUnitByUomId.has(row.parentProductUomId)) {
          throw new ProductUomValidationError('uoms', 'products.uomUnknownParent', 'Parent packaging unit must belong to the same product.');
        }
        parentUnitId = existingUnitByUomId.get(row.parentProductUomId)!;
      }
      return {
        unitId: row.unitId ?? '',
        isBase: row.isBase,
        parentUnitId,
        quantityPerParent: row.quantityPerParent ?? null,
        barcode: row.barcode ?? null,
        isActive: row.isActive ?? true,
      };
    });
  }

  private async assertUnitsExist(tx: any, unitIds: string[]) {
    const unique = [...new Set(unitIds)];
    const found = await tx.unit.findMany({ where: { id: { in: unique } }, select: { id: true } });
    if (found.length !== unique.length) {
      throw new ProductUomValidationError('uoms', 'validation.invalidReference', 'One or more units do not exist in the global unit master.');
    }
  }

  /**
   * Persists an ordered (parents-before-children) UOM plan. The best-effort
   * `@@unique([productId, unitId])` guard plus this ordering keeps parent linkage
   * consistent without needing a second pass.
   */
  private async persistUomPlan(tx: any, productId: string, plan: ReturnType<typeof buildProductUomPlan>) {
    const idByUnit = new Map<string, string>();
    for (const row of plan) {
      const parentId = row.parentUnitId ? idByUnit.get(row.parentUnitId) ?? null : null;
      const created = await tx.productUom.create({
        data: {
          productId,
          unitId: row.unitId,
          isBase: row.isBase,
          parentProductUomId: parentId,
          quantityPerParent: row.quantityPerParent,
          conversionToBase: row.conversionToBase,
          barcode: row.barcode || null,
          isActive: row.isActive,
        },
      });
      idByUnit.set(row.unitId, created.id);
    }
  }

  private async hasInventoryHistory(tx: any, productId: string): Promise<boolean> {
    const [movementLines, balances, countLines] = await Promise.all([
      tx.inventoryMovementLine.count({ where: { productId } }),
      tx.inventoryBalance.count({ where: { productId, OR: [{ quantity: { not: 0 } }, { quantityBase: { not: 0 } }] } }),
      tx.inventoryCountLine.count({ where: { productId } }),
    ]);
    return movementLines > 0 || balances > 0 || countLines > 0;
  }

  /**
   * Stable error contract for product aggregate writes. Shared with
   * `ProductAggregateService` so the unified create/update path maps the same
   * domain and unique-constraint errors identically (never leaks a raw 500).
   */
  rethrowUomError(error: unknown): never {
    if (error instanceof ProductUomValidationError) {
      throw new BadRequestException({
        messageKey: error.messageKey,
        message: error.message,
        errors: [{ field: error.field, code: error.messageKey, message: error.message }],
      });
    }
    // Map a concurrent unique-code violation to a stable 409 contract instead of
    // leaking the raw Prisma error (the pre-tx duplicate check is not atomic).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta as { target?: unknown } | undefined)?.target;
      const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
      if (targetText.includes('code')) {
        throw new ConflictException({
          messageKey: 'products.codeExists',
          message: 'Product code already exists',
        });
      }
    }
    throw error as Error;
  }

  async findAll(
    query: { page?: number; limit?: number; search?: string; categoryId?: string; status?: string },
    ctx?: ActiveOperationalContext,
  ) {
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

    const productionDefinitions = productionDefinitionInclude(ctx);
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          ...PRODUCT_INCLUDE,
          ...(productionDefinitions ? { productionDefinitions } : {}),
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx?: ActiveOperationalContext) {
    const productionDefinitions = productionDefinitionInclude(ctx);
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...PRODUCT_INCLUDE,
        ...(productionDefinitions ? { productionDefinitions } : {}),
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Transaction-aware read used by the aggregate so the response is read inside the same tx. */
  async findOneInTx(tx: any, id: string, ctx?: ActiveOperationalContext) {
    const productionDefinitions = productionDefinitionInclude(ctx);
    const product = await tx.product.findUnique({
      where: { id },
      include: {
        ...PRODUCT_INCLUDE,
        ...(productionDefinitions ? { productionDefinitions } : {}),
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto, userId?: string) {
    const existing = await this.findOne(id);
    try {
      return await this.prisma.$transaction((tx) => this.updateInTx(tx, id, dto, existing, userId));
    } catch (error) {
      throw this.rethrowUomError(error);
    }
  }

  /**
   * Transaction-aware update. `existing` is read once by the caller so the
   * aggregate can wrap this and the production write in a single transaction.
   */
  async updateInTx(tx: any, id: string, dto: UpdateProductDto, existing: any, userId?: string) {
    {
      await this.assertNoProductDuplicate(
        tx,
        {
          code: 'code' in dto ? (dto.code ?? null) : ((existing.code as string) ?? null),
          barcode: 'barcode' in dto ? (dto.barcode ?? null) : ((existing.barcode as string | null) ?? null),
        },
        id,
      );

      // Resolve the (possibly new) base unit and enforce the base-unit lock.
      const nextBase =
        dto.unitId !== undefined || dto.unit !== undefined
          ? await this.resolveBaseUnit(tx, { unitId: dto.unitId, unit: dto.unit })
          : { unitId: existing.unitId, unitCode: existing.unit };
      const baseChanged = (nextBase.unitId ?? null) !== ((existing.unitId as string | null) ?? null);

      if (baseChanged && await this.hasInventoryHistory(tx, id)) {
        throw new ProductUomValidationError(
          'unitId',
          'products.uomBaseUnitLocked',
          'The base inventory unit cannot be changed after inventory history exists for this product.',
        );
      }

      const existingUoms = await tx.productUom.findMany({ where: { productId: id } });
      const existingUnitByUomId = new Map<string, string>(existingUoms.map((row: any) => [row.id, row.unitId]));

      const { uoms, unitId, production, ...scalars } = dto;
      const data: any = { ...scalars };
      if (dto.unitId !== undefined || dto.unit !== undefined) {
        data.unit = nextBase.unitCode;
        data.unitId = nextBase.unitId;
      }

      const product = await tx.product.update({ where: { id }, data });

      if (baseChanged) {
        // Pre-history base change: rebuild the packaging set from the payload.
        await tx.productUom.deleteMany({ where: { productId: id } });
        const rows = this.normalizeUomInput(uoms, null);
        const plan = nextBase.unitId ? buildProductUomPlan(rows, nextBase.unitId) : [];
        if (plan.length) {
          await this.assertUnitsExist(tx, plan.map((row) => row.unitId));
          await this.persistUomPlan(tx, id, plan);
        }
      } else if (uoms !== undefined && nextBase.unitId) {
        await this.syncUomSet(tx, id, nextBase.unitId, this.normalizeUomInput(uoms, existingUnitByUomId));
      } else if (nextBase.unitId) {
        await this.ensureBaseUomRow(tx, id, nextBase.unitId);
      }

      await this.auditService.logWithClient(tx, {
        userId,
        action: 'UPDATE',
        entity: 'Product',
        entityId: id,
        details: { message: `Updated product: ${product.code}`, code: product.code, baseUnitChanged: baseChanged },
      });
      return tx.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    }
  }

  /**
   * Upsert-by-(productId, unitId) sync that preserves row ids and parent
   * linkage: removes packaging rows no longer present, then writes the plan in
   * parents-before-children order.
   */
  private async syncUomSet(tx: any, productId: string, baseUnitId: string, rows: ProductUomRowInput[]) {
    const plan = buildProductUomPlan(rows, baseUnitId);
    await this.assertUnitsExist(tx, plan.map((row) => row.unitId));
    const keepUnits = new Set(plan.map((row) => row.unitId));
    const existing = await tx.productUom.findMany({ where: { productId } });
    const removable = existing.filter((row: any) => !keepUnits.has(row.unitId)).map((row: any) => row.id);
    if (removable.length) await tx.productUom.deleteMany({ where: { id: { in: removable } } });

    const idByUnit = new Map<string, string>(existing.filter((row: any) => keepUnits.has(row.unitId)).map((row: any) => [row.unitId, row.id]));
    for (const row of plan) {
      const parentId = row.parentUnitId ? idByUnit.get(row.parentUnitId) ?? null : null;
      const payload = {
        isBase: row.isBase,
        parentProductUomId: parentId,
        quantityPerParent: row.quantityPerParent,
        conversionToBase: row.conversionToBase,
        barcode: row.barcode || null,
        isActive: row.isActive,
      };
      const existingId = idByUnit.get(row.unitId);
      if (existingId) {
        await tx.productUom.update({ where: { id: existingId }, data: payload });
      } else {
        const created = await tx.productUom.create({ data: { productId, unitId: row.unitId, ...payload } });
        idByUnit.set(row.unitId, created.id);
      }
    }
  }

  private async ensureBaseUomRow(tx: any, productId: string, baseUnitId: string) {
    const baseRow = await tx.productUom.findFirst({ where: { productId, isBase: true } });
    if (baseRow) {
      if (baseRow.unitId !== baseUnitId) {
        await tx.productUom.update({ where: { id: baseRow.id }, data: { unitId: baseUnitId } });
      }
      return;
    }
    const byUnit = await tx.productUom.findFirst({ where: { productId, unitId: baseUnitId } });
    if (byUnit) {
      await tx.productUom.update({ where: { id: byUnit.id }, data: { isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1 } });
      return;
    }
    await tx.productUom.create({
      data: { productId, unitId: baseUnitId, isBase: true, parentProductUomId: null, quantityPerParent: 1, conversionToBase: 1, isActive: true },
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
