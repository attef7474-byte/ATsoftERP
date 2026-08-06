import { Prisma } from '@prisma/client';

export interface FactorResult {
  fraction: string | null;
  percent: string | null;
  numerator: string;
  denominator: string;
  unit: string;
  blockers: string[];
  warnings: string[];
}

export interface OeeProductResult {
  fraction: string | null;
  percent: string | null;
  blockers: string[];
  warnings: string[];
}

export const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

export function round(value: Prisma.Decimal.Value, digits: number): string {
  return decimal(value).toDecimalPlaces(digits).toString();
}

/**
 * Canonical rate normalization. Standard rates are captured per time basis
 * (MINUTE or HOUR); OEE uses units-per-hour.
 */
export function idealRatePerHour(standardRate: Prisma.Decimal.Value, timeBasis: string): Prisma.Decimal {
  const rate = decimal(standardRate);
  if (timeBasis === 'MINUTE') return rate.mul(60);
  return rate;
}

/**
 * A factor is the quotient numerator/denominator. It is null (blocked) when any
 * blocker is present or the denominator is not positive. Values above 1 (100%)
 * are preserved raw and never clamped; presentation-only capping happens on the
 * frontend. Rounding: fraction to 6 decimals, percent to 4 decimals.
 */
export function computeFactor(
  numerator: Prisma.Decimal.Value,
  denominator: Prisma.Decimal.Value,
  unit: string,
  blockers: string[] = [],
  warnings: string[] = [],
): FactorResult {
  const num = decimal(numerator);
  const den = decimal(denominator);
  const effectiveBlockers = [...blockers];
  if (den.lessThanOrEqualTo(0)) effectiveBlockers.push('zeroDenominator');
  if (effectiveBlockers.length > 0) {
    return {
      fraction: null,
      percent: null,
      numerator: round(num, 6),
      denominator: round(den, 6),
      unit,
      blockers: [...new Set(effectiveBlockers)],
      warnings,
    };
  }
  const fraction = num.div(den);
  return {
    fraction: round(fraction, 6),
    percent: round(fraction.mul(100), 4),
    numerator: round(num, 6),
    denominator: round(den, 6),
    unit,
    blockers: [],
    warnings,
  };
}

export function availabilityFactor(
  plannedProductionTimeMinutes: Prisma.Decimal.Value,
  operatingTimeMinutes: Prisma.Decimal.Value,
  warnings: string[] = [],
): FactorResult {
  const blockers = decimal(plannedProductionTimeMinutes).lessThanOrEqualTo(0) ? ['noPlannedProductionTime'] : [];
  return computeFactor(operatingTimeMinutes, plannedProductionTimeMinutes, 'minutes', blockers, warnings);
}

export function performanceFactor(
  idealOutput: Prisma.Decimal.Value,
  actualTotalOutput: Prisma.Decimal.Value,
  blockers: string[] = [],
  warnings: string[] = [],
): FactorResult {
  const result = computeFactor(actualTotalOutput, idealOutput, 'units', blockers, warnings);
  if (result.fraction !== null) {
    const fraction = decimal(result.fraction);
    if (fraction.greaterThan(1)) result.warnings.push('performanceAboveCap');
  }
  return result;
}

export function qualityFactor(
  goodOutput: Prisma.Decimal.Value,
  totalOutput: Prisma.Decimal.Value,
  warnings: string[] = [],
): FactorResult {
  const blockers = decimal(totalOutput).lessThanOrEqualTo(0) ? ['noTotalOutput'] : [];
  const result = computeFactor(goodOutput, totalOutput, 'units', blockers, warnings);
  if (result.fraction !== null && decimal(result.fraction).greaterThan(1)) result.warnings.push('qualityGoodExceedsTotal');
  return result;
}

export function oeeProduct(
  availability: FactorResult | null,
  performance: FactorResult | null,
  quality: FactorResult | null,
): OeeProductResult {
  const factors = [availability, performance, quality];
  const blockers = factors.flatMap((factor) => (factor && factor.blockers.length > 0 ? factor.blockers : factor ? [] : ['unavailableFactor']));
  const warnings = factors.flatMap((factor) => (factor ? factor.warnings : []));
  if (factors.some((factor) => !factor || factor.fraction === null)) {
    return { fraction: null, percent: null, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
  }
  const product = decimal(availability!.fraction!)
    .mul(decimal(performance!.fraction!))
    .mul(decimal(quality!.fraction!));
  if (product.greaterThan(1)) warnings.push('oeeAboveCap');
  return { fraction: round(product, 6), percent: round(product.mul(100), 4), blockers: [], warnings: [...new Set(warnings)] };
}

/** Aggregated factor from summed numerators and denominators (never averaged). */
export function aggregateFactor(numeratorSum: Prisma.Decimal.Value, denominatorSum: Prisma.Decimal.Value, unit: string): FactorResult {
  return computeFactor(numeratorSum, denominatorSum, unit);
}

export function minutesBetween(start: Date, end: Date): Prisma.Decimal {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return new Prisma.Decimal(0);
  return new Prisma.Decimal(ms / 60000);
}

/** Intersection of [start, end] with the query period [from, to]; null when no overlap. */
export function clampedInterval(start: Date, end: Date, from: Date, to: Date): { start: Date; end: Date } | null {
  const lo = start.getTime() > from.getTime() ? start : from;
  const hi = end.getTime() < to.getTime() ? end : to;
  if (hi <= lo) return null;
  return { start: new Date(lo), end: new Date(hi) };
}

export function isPositive(value: Prisma.Decimal.Value): boolean {
  return decimal(value).greaterThan(0);
}
