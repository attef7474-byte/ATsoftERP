import { BadRequestException } from '@nestjs/common';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
export type IssueType = 'SPARE_PART' | 'RAW_MATERIAL' | 'FINISHED_GOODS';
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

/** Product classification comes from the existing spare-part / production authorities. */
export function issueProductScope(type: IssueType, warehouseId: string, ctx: ActiveOperationalContext, productionOrderId?: string) {
  // Catalog eligibility is independent of stock presence. A product with no
  // balance row is still selectable for DRAFT planning (and displays zero
  // stock); physical posting keeps its own canonical sufficiency checks.
  const scope: any = {
    status: 'ACTIVE',
    deletedAt: null
  };
  if (type === 'SPARE_PART') {
    scope.spareParts = {
      some: {
        status: 'ACTIVE',
        deletedAt: null
      }
    };
  } else if (type === 'FINISHED_GOODS') {
    scope.productionDefinitions = {
      some: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
        deletedAt: null
      }
    };
  } else {
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
