import { BadRequestException } from '@nestjs/common';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { ProductItemType } from '../factory/products/product-item-type.domain';

/** Exact user-facing issue vocabulary. `FINISHED_GOOD` is canonical. */
export const ISSUE_TYPES = [
  'SPARE_PART',
  'RAW_MATERIAL',
  'FINISHED_GOOD',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

/** Accepted only for backward compatibility with pre-Phase-5 clients. */
export type LegacyIssueTypeInput = IssueType | 'FINISHED_GOODS';

const ISSUE_TYPE_SET = new Set<string>(ISSUE_TYPES);
const LEGACY_ISSUE_TYPE_ALIASES: Record<string, IssueType> = {
  FINISHED_GOODS: 'FINISHED_GOOD',
};

const GENERAL_ISSUE_TYPES: ReadonlySet<IssueType> = new Set<IssueType>([
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
]);

/** Exact Product.itemType required by each issue type. Null/unclassified is never accepted. */
export const ISSUE_TYPE_ITEM_TYPE: Record<IssueType, ProductItemType> = {
  SPARE_PART: 'SPARE_PART',
  RAW_MATERIAL: 'RAW_MATERIAL',
  FINISHED_GOOD: 'FINISHED_GOOD',
  PACKAGING_MATERIAL: 'PACKAGING_MATERIAL',
  CONSUMABLE: 'CONSUMABLE',
  GENERAL: 'GENERAL',
};

export function isIssueType(value: unknown): value is IssueType {
  return typeof value === 'string' && ISSUE_TYPE_SET.has(value);
}

export function isGeneralIssueType(value: IssueType): boolean {
  return GENERAL_ISSUE_TYPES.has(value);
}

/** Normalizes the legacy plural alias without ever emitting it again. */
export function normalizeIssueTypeInput(value: unknown): IssueType | undefined {
  if (isIssueType(value)) return value;
  if (typeof value === 'string' && LEGACY_ISSUE_TYPE_ALIASES[value]) return LEGACY_ISSUE_TYPE_ALIASES[value];
  return undefined;
}

export function issueSelectionError() {
  return new BadRequestException({
    messageKey: 'inventory.issueVoucher.invalidSelection'
  });
}

export function issueWarehouseScope(ctx: ActiveOperationalContext) {
  if (!ctx?.companyId || !ctx?.branchId) throw issueSelectionError();
  return {
    companyId: ctx.companyId,
    OR: [{
      branchId: ctx.branchId
    }, {
      branchId: null
    }],
    deletedAt: null,
    status: 'ACTIVE'
  };
}

/**
 * A warehouse is selectable only when it already carries at least one catalog
 * item of the selected issue type. This is the backend half of the strict
 * issue-type → warehouse dependency; zero-quantity balance rows still count,
 * because DRAFT planning is allowed and posting owns stock sufficiency.
 */
function issueWarehouseEligibilityForType(type: IssueType, ctx: ActiveOperationalContext) {
  const activeProduct = {
    status: 'ACTIVE',
    deletedAt: null,
    itemType: ISSUE_TYPE_ITEM_TYPE[type]
  };
  const balanceEligibility = type === 'SPARE_PART'
    ? {
        balances: {
          some: {
            product: {
              ...activeProduct,
              spareParts: {
                some: { status: 'ACTIVE', deletedAt: null }
              }
            }
          }
        }
      }
    : {
        balances: {
          some: { product: activeProduct }
        }
      };
  return type === 'FINISHED_GOOD'
    ? {
        OR: [
          balanceEligibility,
          {
            productionProducts: {
              some: {
                companyId: ctx.companyId,
                branchId: ctx.branchId,
                status: 'ACTIVE',
                deletedAt: null,
                product: activeProduct
              }
            }
          },
        ]
      }
    : balanceEligibility;
}

export function issueWarehouseScopeForType(type: IssueType, ctx: ActiveOperationalContext) {
  return { ...issueWarehouseScope(ctx), AND: [issueWarehouseEligibilityForType(type, ctx)] };
}

/**
 * "All types" mode is a UNION of only the issue types the user is authorized
 * to create, still intersected with the active company/branch warehouse scope.
 * This prevents a user with one domain permission from seeing warehouses that
 * are eligible only for an unrelated issue family.
 */
export function issueWarehouseScopeForTypes(types: readonly IssueType[], ctx: ActiveOperationalContext) {
  const uniqueTypes = [...new Set(types)];
  if (!uniqueTypes.length) throw issueSelectionError();
  return {
    ...issueWarehouseScope(ctx),
    AND: [{
      OR: uniqueTypes.map(type => issueWarehouseEligibilityForType(type, ctx))
    }]
  };
}

/** Product classification comes from the canonical item master and native authorities. */
export function issueProductScope(type: IssueType, warehouseId: string, ctx: ActiveOperationalContext, productionOrderId?: string) {
  // Catalog eligibility is independent of stock presence. A product with no
  // balance row is still selectable for DRAFT planning (and displays zero
  // stock); physical posting keeps its own canonical sufficiency checks.
  const scope: any = {
    status: 'ACTIVE',
    deletedAt: null,
    itemType: ISSUE_TYPE_ITEM_TYPE[type]
  };
  if (type === 'SPARE_PART') {
    scope.spareParts = {
      some: {
        status: 'ACTIVE',
        deletedAt: null
      }
    };
  } else if (type === 'FINISHED_GOOD') {
    scope.productionDefinitions = {
      some: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
        deletedAt: null
      }
    };
  } else if (type === 'RAW_MATERIAL') {
    if (!productionOrderId) throw issueSelectionError();
    scope.requirementLines = {
      some: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        OR: [{
          warehouseId
        }, {
          warehouseId: null
        }],
        requirement: {
          productionOrderId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: {
            in: ['DRAFT', 'FROZEN']
          }
        }
      }
    };
  }
  return scope;
}

/** Zero balances remain requestable, matching DRAFT planning. Posting owns sufficiency. */
export async function assertIssueStockSelection(client: any, warehouseId: string, productId: string, ctx: ActiveOperationalContext, line: {
  warehouseLocationId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | Date | null;
} = {}) {
  const where: any = {
    warehouseId,
    productId,
    warehouse: issueWarehouseScope(ctx)
  };
  if (line.warehouseLocationId) where.locationId = line.warehouseLocationId;
  if (line.batchNumber) where.batchNumber = line.batchNumber;
  if (line.serialNumber) where.serialNumber = line.serialNumber;
  if (line.expiryDate) where.expiryDate = new Date(line.expiryDate);
  const balance = await client.inventoryBalance.findFirst({
    where,
    select: {
      id: true,
      quantity: true,
      quantityBase: true
    }
  });
  // A missing balance row is a valid zero-stock / DRAFT planning selection.
  // Sufficiency is owned by the canonical posting path, not by this guard.
  if (!balance) return;
  // An explicitly selected serial that still has a row but was fully issued
  // cannot be selected again.
  if (line.serialNumber) {
    const remaining = balance.quantityBase ?? balance.quantity;
    if (remaining == null || Number(remaining) <= 0) throw issueSelectionError();
  }
}
