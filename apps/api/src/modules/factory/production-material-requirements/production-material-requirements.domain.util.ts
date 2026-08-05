import { Prisma } from '@prisma/client';
import {
  PRODUCTION_MATERIAL_COMPONENT_ROLES,
  PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES,
  PRODUCTION_MATERIAL_REQUIREMENT_STATUSES,
} from './production-material-requirements.constants';

export type ProductionMaterialRequirementStatus = (typeof PRODUCTION_MATERIAL_REQUIREMENT_STATUSES)[number];
export type ProductionMaterialComponentRole = (typeof PRODUCTION_MATERIAL_COMPONENT_ROLES)[number];
export type ProductionMaterialOverIssuePolicy = (typeof PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES)[number];

export function isRequirementStatus(value: string): value is ProductionMaterialRequirementStatus {
  return (PRODUCTION_MATERIAL_REQUIREMENT_STATUSES as readonly string[]).includes(value);
}

export function isComponentRole(value: string): value is ProductionMaterialComponentRole {
  return (PRODUCTION_MATERIAL_COMPONENT_ROLES as readonly string[]).includes(value);
}

export function isOverIssuePolicy(value: string): value is ProductionMaterialOverIssuePolicy {
  return (PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES as readonly string[]).includes(value);
}

/**
 * Total planned quantity for a requirement line for a given order planned
 * quantity. The snapshot freezes the absolute planned quantity so later
 * recipe changes never rewrite it. Conversion factor maps base unit to issue
 * unit when they differ.
 */
export function computePlannedQuantity(
  plannedQuantityPerUnit: Prisma.Decimal.Value,
  orderPlannedQuantity: Prisma.Decimal.Value,
  conversionFactor: Prisma.Decimal.Value,
): Prisma.Decimal {
  const perUnit = new Prisma.Decimal(plannedQuantityPerUnit);
  const planned = new Prisma.Decimal(orderPlannedQuantity);
  const factor = new Prisma.Decimal(conversionFactor);
  return perUnit.mul(planned).mul(factor).toDecimalPlaces(4);
}

export function positiveDecimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.greaterThan(0)) throw new Error('quantityMustBePositive');
  return decimal.toDecimalPlaces(4);
}

/** Tolerance check: net issued quantity may not exceed planned + tolerance percent. */
export function isWithinTolerance(
  issued: Prisma.Decimal.Value,
  planned: Prisma.Decimal.Value,
  tolerancePercent: Prisma.Decimal.Value | null | undefined,
): boolean {
  const plannedDecimal = new Prisma.Decimal(planned);
  const issuedDecimal = new Prisma.Decimal(issued);
  if (issuedDecimal.lessThanOrEqualTo(plannedDecimal)) return true;
  const tolerance = tolerancePercent === null || tolerancePercent === undefined
    ? new Prisma.Decimal(0)
    : new Prisma.Decimal(tolerancePercent);
  const allowed = plannedDecimal.plus(plannedDecimal.mul(tolerance).div(100)).toDecimalPlaces(4);
  return issuedDecimal.lessThanOrEqualTo(allowed);
}

/**
 * Variance status for a requirement line (quantity-only; financial variance is
 * out of scope until Phase 1.8).
 */
export function varianceStatus(
  consumed: Prisma.Decimal.Value,
  planned: Prisma.Decimal.Value,
  tolerancePercent: Prisma.Decimal.Value | null | undefined,
): 'SHORT' | 'OK' | 'OVER' {
  const consumedDecimal = new Prisma.Decimal(consumed);
  const plannedDecimal = new Prisma.Decimal(planned);
  if (consumedDecimal.lessThan(plannedDecimal)) return 'SHORT';
  if (isWithinTolerance(consumedDecimal, plannedDecimal, tolerancePercent)) return 'OK';
  return 'OVER';
}

/**
 * Net issued quantity from the posted movement ledger. Every material document
 * posts exactly one inventory movement; reversals are new posted documents with
 * inverted directions, so summing all posted movements nets automatically.
 * consumed = valid posted issues - valid posted returns - applicable reversals.
 */
export function netIssued(outQuantities: Prisma.Decimal.Value[], inQuantities: Prisma.Decimal.Value[]): Prisma.Decimal {
  const out = outQuantities.reduce<Prisma.Decimal>(
    (sum, q) => sum.plus(new Prisma.Decimal(q)),
    new Prisma.Decimal(0),
  );
  const inQ = inQuantities.reduce<Prisma.Decimal>(
    (sum, q) => sum.plus(new Prisma.Decimal(q)),
    new Prisma.Decimal(0),
  );
  return out.minus(inQ).toDecimalPlaces(4);
}

export function maxDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  if (values.length === 0) return new Prisma.Decimal(0);
  return values.reduce<Prisma.Decimal>((max, v) => (v.greaterThan(max) ? v : max), new Prisma.Decimal(0));
}
