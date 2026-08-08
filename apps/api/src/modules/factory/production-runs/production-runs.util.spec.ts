import { Prisma } from '@prisma/client';
import { deriveRunTotals, normalizeCounterDelta, progressPercent, TotalsInputEvent } from './production-runs.util';

const dec = (v: string) => new Prisma.Decimal(v);

describe('normalizeCounterDelta', () => {
  it('derives the delta from zero baseline on the first reading', () => {
    const result = normalizeCounterDelta(null, dec('100'), null, null);
    expect(result.delta?.toString()).toBe('100');
    expect(result.errorCode).toBeNull();
  });

  it('uses the explicit reset baseline on the first reading', () => {
    const result = normalizeCounterDelta(null, dec('100'), null, dec('90'));
    expect(result.delta?.toString()).toBe('10');
  });

  it('rejects a first reading below the baseline without an explicit reset', () => {
    const result = normalizeCounterDelta(null, dec('80'), null, dec('90'));
    expect(result.delta).toBeNull();
    expect(result.errorCode).toBe('counterBackwardsWithoutReset');
  });

  it('computes a simple advance against the previous raw count', () => {
    const result = normalizeCounterDelta(dec('100'), dec('150'), null, null);
    expect(result.delta?.toString()).toBe('50');
    expect(result.rollover).toBe(false);
  });

  it('computes a rollover delta when a modulus is configured', () => {
    const result = normalizeCounterDelta(dec('900'), dec('50'), dec('1000'), null);
    expect(result.delta?.toString()).toBe('150');
    expect(result.rollover).toBe(true);
  });

  it('rejects an invalid rollover increment', () => {
    const result = normalizeCounterDelta(dec('50'), dec('0'), dec('50'), null);
    expect(result.delta).toBeNull();
    expect(result.errorCode).toBe('counterRolloverInvalid');
  });

  it('rejects a backwards reading without a configured modulus', () => {
    const result = normalizeCounterDelta(dec('150'), dec('90'), null, null);
    expect(result.delta).toBeNull();
    expect(result.errorCode).toBe('counterBackwardsWithoutModulus');
  });
});

describe('deriveRunTotals', () => {
  const baseEvent = (overrides: Partial<TotalsInputEvent>): TotalsInputEvent => ({
    id: 'e1',
    eventType: 'PRODUCTION',
    classification: 'FINAL_OUTPUT',
    quantity: '100.0000',
    goodQuantity: '95.0000',
    rejectQuantity: '5.0000',
    correctsEventId: null,
    measurementPointId: 'mp1',
    measurementPoint: { isAuthoritativeFinal: true },
    ...overrides,
  });

  it('aggregates authoritative final output into headline totals', () => {
    const totals = deriveRunTotals([
      baseEvent({ id: 'e1' }),
      baseEvent({ id: 'e2', quantity: '200.0000', goodQuantity: '190.0000', rejectQuantity: '10.0000' }),
    ]);
    expect(totals.finalOutputTotal).toBe('300');
    expect(totals.finalOutputGood).toBe('285');
    expect(totals.finalOutputReject).toBe('15');
    expect(totals.finalOutputEventCount).toBe(2);
    expect(totals.totalEvents).toBe(2);
  });

  it('keeps non-authoritative final output out of the headline totals', () => {
    const totals = deriveRunTotals([baseEvent({ measurementPoint: { isAuthoritativeFinal: false } })]);
    expect(totals.finalOutputTotal).toBe('0');
    expect(totals.finalOutputEventCount).toBe(0);
    expect(totals.byClassification.FINAL_OUTPUT.quantity).toBe('100');
  });

  it('classifies waste and rework but never into headline final output', () => {
    const totals = deriveRunTotals([
      baseEvent({ id: 'e1', classification: 'WASTE', quantity: '5.0000', goodQuantity: '0', rejectQuantity: '5.0000' }),
      baseEvent({ id: 'e2', classification: 'REWORK', quantity: '3.0000', goodQuantity: '3.0000', rejectQuantity: '0' }),
    ]);
    expect(totals.wasteTotal).toBe('5');
    expect(totals.reworkTotal).toBe('3');
    expect(totals.finalOutputTotal).toBe('0');
  });

  it('nets corrections against their source event without modifying it', () => {
    const totals = deriveRunTotals([
      baseEvent({ id: 'e1' }),
      { ...baseEvent({ id: 'c1', eventType: 'CORRECTION', quantity: '10.0000', goodQuantity: '9.0000', rejectQuantity: '1.0000', correctsEventId: 'e1' }), measurementPoint: { isAuthoritativeFinal: true } },
    ]);
    expect(totals.finalOutputTotal).toBe('90');
    expect(totals.finalOutputGood).toBe('86');
    expect(totals.finalOutputReject).toBe('4');
    expect(totals.correctionsTotal).toBe('10');
    expect(totals.totalEvents).toBe(1);
  });

  it('zeroes the source event when the correction equals the original', () => {
    const totals = deriveRunTotals([
      baseEvent({ id: 'e1' }),
      { ...baseEvent({ id: 'c1', eventType: 'CORRECTION', quantity: '100.0000', goodQuantity: '95.0000', rejectQuantity: '5.0000', correctsEventId: 'e1' }), measurementPoint: { isAuthoritativeFinal: true } },
    ]);
    expect(totals.finalOutputTotal).toBe('0');
    expect(totals.finalOutputGood).toBe('0');
    expect(totals.finalOutputReject).toBe('0');
    expect(totals.correctionsTotal).toBe('100');
  });

  it('caps good/reject reduction at the correction quantity', () => {
    const totals = deriveRunTotals([
      baseEvent({ id: 'e1' }),
      { ...baseEvent({ id: 'c1', eventType: 'CORRECTION', quantity: '10.0000', goodQuantity: '500.0000', rejectQuantity: '0', correctsEventId: 'e1' }), measurementPoint: { isAuthoritativeFinal: true } },
    ]);
    expect(totals.finalOutputTotal).toBe('90');
    expect(totals.finalOutputGood).toBe('85');
  });

  it('counts resets as traceability only', () => {
    const totals = deriveRunTotals([
      { ...baseEvent({ id: 'r1', eventType: 'RESET', quantity: '0', goodQuantity: '0', rejectQuantity: '0' }), measurementPoint: { isAuthoritativeFinal: true } },
    ]);
    expect(totals.totalEvents).toBe(0);
    expect(totals.finalOutputTotal).toBe('0');
  });
});

describe('progressPercent', () => {
  it('returns zero when the planned quantity is not positive', () => {
    expect(progressPercent('10', '0')).toBe('0');
  });

  it('computes progress against the planned quantity', () => {
    expect(progressPercent('250', '1000')).toBe('25');
  });
});
