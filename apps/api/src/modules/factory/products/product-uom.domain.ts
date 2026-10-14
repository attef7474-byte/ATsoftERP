import { Prisma } from '@prisma/client';

/**
 * Pure domain logic for Product multi-UOM packaging.
 *
 * A Product has exactly ONE base inventory unit (the mathematical inventory
 * authority). Every other usable unit is a packaging UOM that resolves to the
 * base through an acyclic parent chain:
 *
 *   conversionToBase = quantityPerParent * parent.conversionToBase
 *   base row        => conversionToBase = 1
 *
 * No float arithmetic is used for the conversion factors (Prisma.Decimal).
 */
export interface ProductUomRowInput {
  unitId: string;
  isBase?: boolean;
  parentUnitId?: string | null;
  quantityPerParent?: number | string | null;
  barcode?: string | null;
  isActive?: boolean;
}

export interface ProductUomPlanRow {
  unitId: string;
  isBase: boolean;
  parentUnitId: string | null;
  quantityPerParent: Prisma.Decimal;
  conversionToBase: Prisma.Decimal;
  barcode: string | null;
  isActive: boolean;
}

export class ProductUomValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly messageKey: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProductUomValidationError';
  }
}

function toPositiveDecimal(value: number | string | null | undefined, field: string): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    throw new ProductUomValidationError(
      field,
      'products.uomParentConversionRequired',
      'A packaging unit must define a positive quantity-per-parent conversion.',
    );
  }
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new ProductUomValidationError(
      field,
      'validation.invalidQuantity',
      'Quantity-per-parent must be a valid positive number.',
    );
  }
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new ProductUomValidationError(
      field,
      'validation.invalidQuantity',
      'Quantity-per-parent must be greater than 0.',
    );
  }
  return decimal;
}

/**
 * Validates the incoming product UOM rows and produces an ordered, acyclic plan
 * with the resolved conversion-to-base for every row. The base row is either the
 * supplied base unit or a single row explicitly marked as base; both must agree.
 *
 * Parents are expressed by `parentUnitId` so the service can supply either
 * new-in-payload parents or existing rows (already normalised from
 * productUomId to unitId).
 */
export function buildProductUomPlan(
  rows: ProductUomRowInput[],
  baseUnitId: string,
): ProductUomPlanRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.unitId) {
      throw new ProductUomValidationError('uoms', 'validation.invalidReference', 'Each packaging unit requires a unitId.');
    }
    if (seen.has(row.unitId)) {
      throw new ProductUomValidationError('uoms', 'products.uomDuplicateUnit', 'A unit may only appear once per product.');
    }
    seen.add(row.unitId);
  }

  const explicitBase = rows.filter((row) => row.isBase === true);
  if (explicitBase.length > 1) {
    throw new ProductUomValidationError('uoms', 'products.uomMultipleBase', 'A product may have only one base unit.');
  }
  if (explicitBase.length === 1 && explicitBase[0].unitId !== baseUnitId) {
    throw new ProductUomValidationError(
      'uoms',
      'products.uomBaseMismatch',
      'The packaging base unit must match the product base inventory unit.',
    );
  }

  const byUnit = new Map<string, ProductUomRowInput>();
  for (const row of rows) byUnit.set(row.unitId, row);

  const baseRow: ProductUomPlanRow = {
    unitId: baseUnitId,
    isBase: true,
    parentUnitId: null,
    quantityPerParent: new Prisma.Decimal(1),
    conversionToBase: new Prisma.Decimal(1),
    barcode: (byUnit.get(baseUnitId)?.barcode ?? null) || null,
    isActive: byUnit.get(baseUnitId)?.isActive ?? true,
  };

  const result = new Map<string, ProductUomPlanRow>();
  result.set(baseUnitId, baseRow);

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const resolve = (unitId: string): ProductUomPlanRow => {
    if (visited.has(unitId)) return result.get(unitId)!;
    if (visiting.has(unitId)) {
      throw new ProductUomValidationError('uoms', 'products.uomCycle', 'Packaging units must not form a cycle.');
    }
    visiting.add(unitId);

    const row = byUnit.get(unitId)!;
    const parentUnit = row.parentUnitId ?? null;

    let parentPlan: ProductUomPlanRow;
    if (!parentUnit || parentUnit === baseUnitId) {
      parentPlan = baseRow;
    } else {
      if (parentUnit === unitId) {
        throw new ProductUomValidationError('uoms', 'products.uomSelfParent', 'A unit cannot be its own parent.');
      }
      if (!byUnit.has(parentUnit)) {
        throw new ProductUomValidationError('uoms', 'products.uomUnknownParent', 'Parent unit must belong to the same product.');
      }
      parentPlan = resolve(parentUnit);
    }

    const qpp = toPositiveDecimal(row.quantityPerParent, `uoms.${unitId}.quantityPerParent`);
    const plan: ProductUomPlanRow = {
      unitId,
      isBase: false,
      parentUnitId: parentPlan.unitId,
      quantityPerParent: qpp,
      conversionToBase: qpp.mul(parentPlan.conversionToBase),
      barcode: row.barcode ?? null,
      isActive: row.isActive ?? true,
    };
    visiting.delete(unitId);
    visited.add(unitId);
    result.set(unitId, plan);
    return plan;
  };

  for (const unitId of byUnit.keys()) {
    if (unitId === baseUnitId) continue;
    resolve(unitId);
  }

  // Order parents before children so rows can be persisted sequentially.
  const ordered: ProductUomPlanRow[] = [baseRow];
  const emitted = new Set<string>([baseUnitId]);
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const plan of result.values()) {
      if (emitted.has(plan.unitId)) continue;
      const parentUnit = plan.parentUnitId;
      if (parentUnit && !emitted.has(parentUnit)) continue;
      ordered.push(plan);
      emitted.add(plan.unitId);
      progressed = true;
    }
  }

  return ordered;
}

/**
 * Applies the resolved conversion factor to an entered quantity, producing the
 * authoritative base-unit quantity. Factor must be strictly positive.
 */
export function computeBaseQuantity(
  enteredQuantity: Prisma.Decimal,
  conversionToBase: Prisma.Decimal,
): Prisma.Decimal {
  if (conversionToBase.lte(0)) {
    throw new ProductUomValidationError('productUomId', 'validation.invalidValue', 'Conversion factor must be positive.');
  }
  return enteredQuantity.mul(conversionToBase);
}
