import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION,
  INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
  INVENTORY_VALUATION_POLICY_ACTIONS,
} from './inventory-valuation.constants';
import { CreateInventoryValuationPolicyDto } from './dto/create-policy.dto';
import { UpdateInventoryValuationPolicyDto } from './dto/update-policy.dto';
import { InventoryValuationPolicyQueryDto } from './dto/policy-query.dto';
import { CostInputDto } from './dto/cost-input.dto';
import { InitializeProductDto } from './dto/initialize.dto';
import { InitializationQueryDto } from './dto/initialization-query.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryValuationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── policy lifecycle ───────────────────────────────────────────────────────

  async createPolicy(dto: CreateInventoryValuationPolicyDto, userId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    const currencyCode = dto.currencyCode.trim().toUpperCase();

    const existing = await this.prisma.inventoryValuationPolicy.findFirst({
      where: { companyId: ctx.companyId, warehouseId: dto.warehouseId },
    });
    if (existing) {
      throw new ConflictException({ messageKey: 'inventoryValuation.policyExists', message: 'A valuation policy already exists for this warehouse' });
    }

    const policy = await this.prisma.inventoryValuationPolicy.create({
      data: {
        companyId: ctx.companyId,
        warehouseId: dto.warehouseId,
        method: dto.method,
        currencyCode,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    await this.audit.log(userId, INVENTORY_VALUATION_POLICY_ACTIONS.policyCreate, INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, policy.id, {
      companyId: ctx.companyId,
      warehouseId: dto.warehouseId,
      method: dto.method,
      currencyCode,
    });
    return policy;
  }

  async updatePolicy(id: string, dto: UpdateInventoryValuationPolicyDto, userId: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(id, ctx);

    if (policy.status !== 'DRAFT' && policy.status !== 'INITIALIZING') {
      throw new BadRequestException({ messageKey: 'inventoryValuation.policyNotEditable', message: 'Only DRAFT or INITIALIZING valuation policies can be updated' });
    }

    const data: { method?: string; currencyCode?: string } = {};

    if (dto.method !== undefined) {
      if (policy.status !== 'DRAFT') {
        throw new BadRequestException({ messageKey: 'inventoryValuation.methodFrozen', message: 'Valuation method is frozen once initialization has begun' });
      }
      data.method = dto.method;
    }

    if (dto.currencyCode !== undefined) {
      if (policy.status !== 'DRAFT') {
        throw new BadRequestException({ messageKey: 'inventoryValuation.currencyFrozen', message: 'Currency is frozen once monetary initialization has begun' });
      }
      data.currencyCode = dto.currencyCode.trim().toUpperCase();
    }

    const updated = await this.prisma.inventoryValuationPolicy.update({
      where: { id: policy.id },
      data: { ...data, updatedById: userId },
    });

    await this.audit.log(userId, INVENTORY_VALUATION_POLICY_ACTIONS.policyUpdate, INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, policy.id, {
      companyId: ctx.companyId,
      ...data,
    });
    return updated;
  }

  async beginInitialization(id: string, userId: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(id, ctx);
    if (policy.status !== 'DRAFT') {
      throw new BadRequestException({ messageKey: 'inventoryValuation.policyNotDraft', message: 'Only a DRAFT valuation policy can begin initialization' });
    }

    const updated = await this.prisma.inventoryValuationPolicy.update({
      where: { id: policy.id },
      data: { status: 'INITIALIZING', updatedById: userId },
    });

    await this.audit.log(userId, INVENTORY_VALUATION_POLICY_ACTIONS.policyInitializationStart, INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, policy.id, {
      companyId: ctx.companyId,
      oldStatus: policy.status,
      newStatus: 'INITIALIZING',
    });
    return updated;
  }

  // ── explicit monetary input on legacy opening / receipt lines ─────────────

  async inputOpeningCost(policyId: string, dto: CostInputDto, userId: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(policyId, ctx);
    this.assertMonetaryInputAllowed(policy);
    this.assertCurrencyMatches(policy, dto.currencyCode);
    this.assertCostValid(dto.unitCost, dto.reason);

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.inventoryOpeningBalanceLine.findUnique({
        where: { id: dto.lineId },
        include: { openingBalance: true },
      });
      if (!line) {
        throw new NotFoundException({ messageKey: 'inventoryValuation.lineNotFound', message: 'Opening balance line not found' });
      }
      this.assertCostSourceInContext(line.openingBalance, policy, ctx);

      const updated = await tx.inventoryOpeningBalanceLine.update({
        where: { id: line.id },
        data: { unitCost: new Prisma.Decimal(dto.unitCost), currencyCode: policy.currencyCode, valuationReason: dto.reason },
        include: { product: { select: { id: true, code: true, name: true } } },
      });

      await this.writeAudit(tx, userId, INVENTORY_VALUATION_POLICY_ACTIONS.openingCostInput, INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, policy.id, ctx, {
        lineId: line.id,
        productId: line.productId,
        unitCost: dto.unitCost,
        currencyCode: policy.currencyCode,
      });
      return updated;
    });
  }

  async inputReceiptCost(policyId: string, dto: CostInputDto, userId: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(policyId, ctx);
    this.assertMonetaryInputAllowed(policy);
    this.assertCurrencyMatches(policy, dto.currencyCode);
    this.assertCostValid(dto.unitCost, dto.reason);

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.inventoryOperationalReceiptLine.findUnique({
        where: { id: dto.lineId },
        include: { receipt: true },
      });
      if (!line) {
        throw new NotFoundException({ messageKey: 'inventoryValuation.lineNotFound', message: 'Operational receipt line not found' });
      }
      this.assertCostSourceInContext(line.receipt, policy, ctx);

      const updated = await tx.inventoryOperationalReceiptLine.update({
        where: { id: line.id },
        data: { unitCost: new Prisma.Decimal(dto.unitCost), currencyCode: policy.currencyCode, valuationReason: dto.reason },
        include: { product: { select: { id: true, code: true, name: true } } },
      });

      await this.writeAudit(tx, userId, INVENTORY_VALUATION_POLICY_ACTIONS.receiptCostInput, INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, policy.id, ctx, {
        lineId: line.id,
        productId: line.productId,
        unitCost: dto.unitCost,
        currencyCode: policy.currencyCode,
      });
      return updated;
    });
  }

  // ── derived readiness ──────────────────────────────────────────────────────

  async getReadiness(id: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(id, ctx);
    await assertWarehouseInContext(this.prisma, policy.warehouseId, ctx);

    const [balances, initialized] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where: { warehouseId: policy.warehouseId },
        select: { productId: true, quantity: true, quantityBase: true },
      }),
      this.prisma.inventoryValuationInitialization.findMany({
        where: { companyId: ctx.companyId, warehouseId: policy.warehouseId },
        select: { productId: true },
      }),
    ]);

    const quantByProduct = new Map<string, Prisma.Decimal>();
    for (const b of balances) {
      const q = b.quantityBase !== null && b.quantityBase !== undefined
        ? new Prisma.Decimal(b.quantityBase.toString())
        : new Prisma.Decimal(Number.isFinite(b.quantity) ? b.quantity : 0);
      quantByProduct.set(b.productId, (quantByProduct.get(b.productId) ?? new Prisma.Decimal(0)).plus(q));
    }

    const initializedSet = new Set(initialized.map((i) => i.productId));
    const products: { productId: string; quantitySnapshot: string; initialized: boolean }[] = [];
    for (const [productId, qty] of quantByProduct) {
      if (qty.lte(0)) continue;
      products.push({
        productId,
        quantitySnapshot: qty.toFixed(4),
        initialized: initializedSet.has(productId),
      });
    }
    products.sort((a, b) => a.productId.localeCompare(b.productId));

    const initializedCount = products.filter((p) => p.initialized).length;
    const missing = products.filter((p) => !p.initialized);
    const ready = products.length > 0 && missing.length === 0;

    return {
      policyId: policy.id,
      warehouseId: policy.warehouseId,
      method: policy.method,
      status: policy.status,
      currencyCode: policy.currencyCode,
      productsWithStock: products.length,
      initializedCount,
      missingCount: missing.length,
      ready,
      missingProducts: missing,
      products,
    };
  }

  // ── legacy stock initialization (primary feature) ──────────────────────────

  async initializeProduct(policyId: string, dto: InitializeProductDto, userId: string, ctx: ActiveOperationalContext) {
    const policy = await this.findPolicy(policyId, ctx);
    if (policy.status !== 'INITIALIZING') {
      throw new BadRequestException({ messageKey: 'inventoryValuation.policyNotInInitializing', message: 'Only an INITIALIZING valuation policy can initialize stock' });
    }
    this.assertCostValid(dto.unitCost, dto.reason);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.deletedAt) {
      throw new NotFoundException({ messageKey: 'inventoryValuation.productNotFound', message: 'Product not found' });
    }

    const unitCost = new Prisma.Decimal(Number(dto.unitCost).toFixed(6));

    const result = await this.prisma.$transaction(async (tx) => {
      const policyInTx = await tx.inventoryValuationPolicy.findUnique({ where: { id: policy.id } });
      if (!policyInTx || policyInTx.companyId !== ctx.companyId || policyInTx.warehouseId !== policy.warehouseId) {
        throw new ForbiddenException('forbidden: valuation policy does not belong to active context');
      }
      if (policyInTx.status !== 'INITIALIZING') {
        throw new BadRequestException({ messageKey: 'inventoryValuation.policyNotInInitializing', message: 'Only an INITIALIZING valuation policy can initialize stock' });
      }

      const quantitySnapshot = await this.aggregatePhysicalQuantity(tx, policy.warehouseId, dto.productId);
      if (quantitySnapshot.lte(0)) {
        throw new BadRequestException({ messageKey: 'inventoryValuation.noStock', message: 'Cannot initialize a product with no physical stock in this warehouse' });
      }

      const existingInit = await tx.inventoryValuationInitialization.findFirst({
        where: { companyId: ctx.companyId, warehouseId: policy.warehouseId, productId: dto.productId },
      });
      if (existingInit) {
        throw new ConflictException({ messageKey: 'inventoryValuation.initializationExists', message: 'This product was already initialized for this company and warehouse' });
      }

      const existingBalance = await tx.inventoryValuationBalance.findUnique({
        where: { companyId_warehouseId_productId: { companyId: ctx.companyId, warehouseId: policy.warehouseId, productId: dto.productId } },
      });
      if (existingBalance) {
        throw new ConflictException({ messageKey: 'inventoryValuation.balanceExists', message: 'A valuation balance already exists for this product; re-initialization is not allowed' });
      }

      const totalValue = quantitySnapshot.mul(unitCost).toDecimalPlaces(4);

      const initialization = await tx.inventoryValuationInitialization.create({
        data: {
          companyId: ctx.companyId,
          warehouseId: policy.warehouseId,
          productId: dto.productId,
          policyId: policy.id,
          quantitySnapshot,
          unitCost,
          totalValue,
          currencyCode: policy.currencyCode,
          reason: dto.reason,
          createdById: userId,
        },
      });

      const balance = await tx.inventoryValuationBalance.create({
        data: {
          companyId: ctx.companyId,
          warehouseId: policy.warehouseId,
          productId: dto.productId,
          averageUnitCost: unitCost,
          inventoryValue: totalValue,
          lastHistoricalUnitCost: unitCost,
          version: 1,
        },
      });

      await tx.inventoryValuationPolicy.update({
        where: { id: policy.id },
        data: { initializedAt: new Date(), initializedById: userId, updatedById: userId },
      });

      await this.writeAudit(tx, userId, INVENTORY_VALUATION_POLICY_ACTIONS.legacyValuationInitialize, INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION, initialization.id, ctx, {
        policyId: policy.id,
        productId: dto.productId,
        warehouseId: policy.warehouseId,
        quantitySnapshot: quantitySnapshot.toFixed(4),
        unitCost: unitCost.toFixed(6),
        totalValue: totalValue.toFixed(4),
        currencyCode: policy.currencyCode,
      });

      return { initialization, balance };
    });

    // NOTE: R1B intentionally creates NO InventoryMovement/line and does NOT
    // modify InventoryBalance.quantity/quantityBase. Physical stock is untouched.
    return result;
  }

  // ── queries ────────────────────────────────────────────────────────────────

  async findPolicies(query: InventoryValuationPolicyQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.InventoryValuationPolicyWhereInput = { companyId: ctx.companyId, deletedAt: null };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [{ currencyCode: { contains: query.search } }];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryValuationPolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { initializations: true } },
        },
      }),
      this.prisma.inventoryValuationPolicy.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findPolicy(id: string, ctx: ActiveOperationalContext) {
    const policy = await this.prisma.inventoryValuationPolicy.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        initializations: { orderBy: { createdAt: 'desc' }, take: 200 },
      },
    });
    if (!policy || policy.deletedAt) {
      throw new NotFoundException({ messageKey: 'inventoryValuation.policyNotFound', message: 'Valuation policy not found' });
    }
    assertRowInContext(policy, ctx, 'valuation policy');
    return policy;
  }

  async findInitializations(query: InitializationQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.InventoryValuationInitializationWhereInput = { companyId: ctx.companyId };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryValuationInitialization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, code: true, name: true, unit: true } },
        },
      }),
      this.prisma.inventoryValuationInitialization.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertMonetaryInputAllowed(policy: { status: string }) {
    if (policy.status !== 'DRAFT' && policy.status !== 'INITIALIZING') {
      throw new BadRequestException({ messageKey: 'inventoryValuation.policyNotEditable', message: 'Monetary input is only allowed on a DRAFT or INITIALIZING valuation policy' });
    }
  }

  private assertCurrencyMatches(policy: { currencyCode: string }, provided: string) {
    if (provided.trim().toUpperCase() !== policy.currencyCode.toUpperCase()) {
      throw new BadRequestException({ messageKey: 'inventoryValuation.currencyMismatch', message: 'Currency must match the valuation policy currency' });
    }
  }

  private assertCostValid(unitCost: number, reason?: string) {
    if (unitCost < 0) {
      throw new BadRequestException({ messageKey: 'inventoryValuation.negativeCost', message: 'Unit cost cannot be negative' });
    }
    if (unitCost === 0 && (!reason || !reason.trim())) {
      throw new BadRequestException({ messageKey: 'inventoryValuation.zeroCostRequiresReason', message: 'A zero unit cost requires an explicit reason' });
    }
  }

  private assertCostSourceInContext(
    source: { companyId: string; branchId?: string | null; warehouseId: string },
    policy: { warehouseId: string },
    ctx: ActiveOperationalContext,
  ) {
    if (source.companyId !== ctx.companyId) {
      throw new ForbiddenException('forbidden: source document does not belong to active company');
    }
    if (source.branchId && source.branchId !== ctx.branchId) {
      throw new ForbiddenException('forbidden: source document does not belong to active branch');
    }
    if (source.warehouseId !== policy.warehouseId) {
      throw new BadRequestException({ messageKey: 'inventoryValuation.warehouseMismatch', message: 'Cost source warehouse must match the valuation policy warehouse' });
    }
  }

  private async aggregatePhysicalQuantity(tx: Tx, warehouseId: string, productId: string): Promise<Prisma.Decimal> {
    const balances = await tx.inventoryBalance.findMany({
      where: { warehouseId, productId },
      select: { quantity: true, quantityBase: true },
    });
    // Authoritative aggregated physical quantity: sum of quantityBase, falling
    // back to the legacy Float quantity when quantityBase is null. Derived here,
    // never client supplied.
    let sum = new Prisma.Decimal(0);
    for (const b of balances) {
      if (b.quantityBase !== null && b.quantityBase !== undefined) {
        sum = sum.plus(new Prisma.Decimal(b.quantityBase.toString()));
      } else {
        sum = sum.plus(new Prisma.Decimal(Number.isFinite(b.quantity) ? b.quantity : 0));
      }
    }
    return sum;
  }

  private async writeAudit(
    tx: Tx,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    details: Record<string, any>,
  ) {
    await this.audit.logWithClient(tx, {
      userId,
      action,
      entity,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }
}
