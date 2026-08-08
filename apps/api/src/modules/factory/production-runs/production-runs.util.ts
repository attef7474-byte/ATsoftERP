import { Prisma } from '@prisma/client';

export interface CounterNormalizationResult {
  delta: Prisma.Decimal | null;
  rollover: boolean;
  errorCode: string | null;
}

export interface NetEventQuantities {
  quantity: Prisma.Decimal;
  good: Prisma.Decimal;
  reject: Prisma.Decimal;
}

export interface TotalsInputEvent {
  id: string;
  eventType: string;
  classification: string;
  quantity: Prisma.Decimal.Value;
  goodQuantity: Prisma.Decimal.Value;
  rejectQuantity: Prisma.Decimal.Value;
  correctsEventId: string | null;
  measurementPointId: string;
  measurementPoint?: { isAuthoritativeFinal?: boolean } | null;
}

export interface DerivedTotals {
  byClassification: Record<string, { quantity: string; goodQuantity: string; rejectQuantity: string; eventCount: number }>;
  finalOutputTotal: string;
  finalOutputGood: string;
  finalOutputReject: string;
  finalOutputEventCount: number;
  totalEvents: number;
  wasteTotal: string;
  reworkTotal: string;
  correctionsTotal: string;
}

/**
 * Pure counter normalization. Raw counter values and derived increments stay distinct.
 * - previousRawCount null (first reading): baseline is resetValue (explicit reset) or zero.
 * - rawCount >= previous: simple advance.
 * - rawCount < previous: rollover requires a configured modulus, otherwise the operator
 *   must issue an explicit reset event (never a guessed negative quantity).
 */
export function normalizeCounterDelta(
  previousRawCount: Prisma.Decimal | null,
  rawCount: Prisma.Decimal,
  modulus: Prisma.Decimal | null,
  resetBaseline: Prisma.Decimal | null,
): CounterNormalizationResult {
  const baseline = resetBaseline ?? new Prisma.Decimal(0);
  if (previousRawCount === null) {
    const delta = rawCount.minus(baseline);
    if (delta.lessThan(0)) return { delta: null, rollover: false, errorCode: 'counterBackwardsWithoutReset' };
    return { delta, rollover: false, errorCode: null };
  }
  if (rawCount.greaterThanOrEqualTo(previousRawCount)) {
    return { delta: rawCount.minus(previousRawCount), rollover: false, errorCode: null };
  }
  if (modulus !== null && modulus.greaterThan(0)) {
    const delta = modulus.minus(previousRawCount).plus(rawCount);
    if (delta.lessThanOrEqualTo(0)) return { delta: null, rollover: true, errorCode: 'counterRolloverInvalid' };
    return { delta, rollover: true, errorCode: null };
  }
  return { delta: null, rollover: false, errorCode: 'counterBackwardsWithoutModulus' };
}

/**
 * Immutable-event netting: each PRODUCTION event contributes its recorded facts minus
 * every CORRECTION event that references it. Original events are never modified.
 */
export function netEventQuantities(events: TotalsInputEvent[]): Map<string, NetEventQuantities> {
  const net = new Map<string, NetEventQuantities>();
  for (const event of events) {
    if (event.eventType !== 'PRODUCTION') continue;
    net.set(event.id, {
      quantity: new Prisma.Decimal(event.quantity),
      good: new Prisma.Decimal(event.goodQuantity),
      reject: new Prisma.Decimal(event.rejectQuantity),
    });
  }
  for (const event of events) {
    if (event.eventType !== 'CORRECTION' || !event.correctsEventId) continue;
    const target = net.get(event.correctsEventId);
    if (!target) continue;
    const correction = new Prisma.Decimal(event.quantity);
    target.quantity = target.quantity.minus(correction);
    target.good = target.good.minus(Prisma.Decimal.min(event.goodQuantity, correction));
    target.reject = target.reject.minus(Prisma.Decimal.min(event.rejectQuantity, correction));
  }
  return net;
}

/**
 * Derived totals over the immutable event ledger.
 * Only FINAL_OUTPUT events on an authoritative measurement point contribute to the
 * headline final output; INPUT/INTERMEDIATE/WASTE/REWORK stay traceability records.
 * Resets and corrections never create standalone positive totals.
 */
export function deriveRunTotals(events: TotalsInputEvent[]): DerivedTotals {
  const net = netEventQuantities(events);
  const byClassification: Record<string, { quantity: Prisma.Decimal; good: Prisma.Decimal; reject: Prisma.Decimal; eventCount: number }> = {};
  let finalOutputTotal = new Prisma.Decimal(0);
  let finalOutputGood = new Prisma.Decimal(0);
  let finalOutputReject = new Prisma.Decimal(0);
  let finalOutputEventCount = 0;
  let totalEvents = 0;

  for (const event of events) {
    if (event.eventType !== 'PRODUCTION') continue;
    totalEvents += 1;
    const row = net.get(event.id);
    if (!row) continue;
    const classification = event.classification;
    if (!byClassification[classification]) {
      byClassification[classification] = { quantity: new Prisma.Decimal(0), good: new Prisma.Decimal(0), reject: new Prisma.Decimal(0), eventCount: 0 };
    }
    byClassification[classification].quantity = byClassification[classification].quantity.plus(row.quantity);
    byClassification[classification].good = byClassification[classification].good.plus(row.good);
    byClassification[classification].reject = byClassification[classification].reject.plus(row.reject);
    byClassification[classification].eventCount += 1;
    if (classification === 'FINAL_OUTPUT' && event.measurementPoint?.isAuthoritativeFinal) {
      finalOutputTotal = finalOutputTotal.plus(row.quantity);
      finalOutputGood = finalOutputGood.plus(row.good);
      finalOutputReject = finalOutputReject.plus(row.reject);
      finalOutputEventCount += 1;
    }
  }

  const serialized: DerivedTotals['byClassification'] = {};
  for (const [classification, row] of Object.entries(byClassification)) {
    serialized[classification] = {
      quantity: row.quantity.toDecimalPlaces(4).toString(),
      goodQuantity: row.good.toDecimalPlaces(4).toString(),
      rejectQuantity: row.reject.toDecimalPlaces(4).toString(),
      eventCount: row.eventCount,
    };
  }
  const toDecimal = (value: Prisma.Decimal): string => value.toDecimalPlaces(4).toString();
  let correctionsTotal = new Prisma.Decimal(0);
  for (const event of events) {
    if (event.eventType !== 'CORRECTION') continue;
    correctionsTotal = correctionsTotal.plus(new Prisma.Decimal(event.quantity));
  }
  return {
    byClassification: serialized,
    finalOutputTotal: toDecimal(finalOutputTotal),
    finalOutputGood: toDecimal(finalOutputGood),
    finalOutputReject: toDecimal(finalOutputReject),
    finalOutputEventCount,
    totalEvents,
    wasteTotal: byClassification['WASTE'] ? toDecimal(byClassification['WASTE'].quantity) : '0',
    reworkTotal: byClassification['REWORK'] ? toDecimal(byClassification['REWORK'].quantity) : '0',
    correctionsTotal: toDecimal(correctionsTotal),
  };
}

export function progressPercent(finalOutputTotal: Prisma.Decimal.Value, plannedQuantity: Prisma.Decimal.Value): string {
  const planned = new Prisma.Decimal(plannedQuantity);
  if (planned.lessThanOrEqualTo(0)) return '0';
  return new Prisma.Decimal(finalOutputTotal).div(planned).mul(100).toDecimalPlaces(2).toString();
}