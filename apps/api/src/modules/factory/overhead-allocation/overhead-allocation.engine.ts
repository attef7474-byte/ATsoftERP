import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isCostPurpose } from '../../../common/cost-purpose/cost-purpose.constants';

// Local constructor: no global Decimal precision/rounding changes for other domains.
const Decimal = Prisma.Decimal.clone({ precision: 80, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const OVERHEAD_ALLOCATION_DRIVER = 'FINAL_GOOD_OUTPUT_QUANTITY';
export const OVERHEAD_ALLOCATION_MAX_SOURCES = 10000;
export const OVERHEAD_ALLOCATION_MAX_TARGETS = 5000;
export const ALLOCATION_PRECISION_ERROR = 'overheadAllocation.notRepresentableAtPrecision';
export interface AllocationSourceInput { id: string; costPurpose: string; amount: string; currencyCode: string }
export interface AllocationTargetInput { id: string; driverQuantity: string }

const fail = (messageKey: string): never => { throw new BadRequestException({ messageKey }); };
const validDecimal = (text: string, max: string, key: string) => {
  if (!/^\d+(\.\d{1,4})?$/.test(text)) return fail(key);
  const value = new Decimal(text);
  if (!value.isFinite() || !value.gt(0) || value.gt(max)) return fail(key);
  return value;
};

/** Frozen proportional/HALF_UP/single-largest-remainder policy; no persistence. */
export function calculateOverheadAllocation(sources: AllocationSourceInput[], targets: AllocationTargetInput[], currencyCode: string) {
  if (!sources.length || !targets.length) return fail('overheadAllocation.noInputs');
  if (sources.length > OVERHEAD_ALLOCATION_MAX_SOURCES || targets.length > OVERHEAD_ALLOCATION_MAX_TARGETS) return fail('overheadAllocation.tooManyInputs');
  if (new Set(sources.map(s => s.id)).size !== sources.length || new Set(targets.map(t => t.id)).size !== targets.length) return fail('overheadAllocation.invalidInputs');
  if (!/^[A-Z]{3}$/.test(currencyCode)) return fail('overhead.currencyNotConfigured');
  const pools = new Map<string, Prisma.Decimal>();
  // Stable source ordering also makes the provenance response reproducible.
  for (const source of [...sources].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (!isCostPurpose(source.costPurpose)) return fail('overhead.costPurposeInvalid');
    if (source.currencyCode !== currencyCode) return fail('overhead.currencyMismatch');
    const amount = validDecimal(source.amount, '999999999999999.9999', 'overhead.amountInvalid');
    pools.set(source.costPurpose, (pools.get(source.costPurpose) ?? new Decimal(0)).plus(amount));
  }
  const drivers = targets.map(target => ({
    id: target.id,
    quantity: validDecimal(target.driverQuantity, '99999999999999.9999', 'overheadAllocation.invalidDriver'),
  })).sort((a, b) => b.quantity.comparedTo(a.quantity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const totalDriver = drivers.reduce((sum, row) => sum.plus(row.quantity), new Decimal(0));
  const minimumTotal = new Decimal(targets.length.toString()).times('0.0001');
  const lines: Array<{ productionRunId: string; costPurpose: string; driverType: string; driverQuantity: string; totalDriver: string; poolAmount: string; allocatedAmount: string; currencyCode: string }> = [];
  for (const [costPurpose, pool] of [...pools].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (pool.lt(minimumTotal)) return fail(ALLOCATION_PRECISION_ERROR);
    const rounded = drivers.map(row => pool.times(row.quantity).div(totalDriver).toDecimalPlaces(4, Decimal.ROUND_HALF_UP));
    const remainder = pool.minus(rounded.reduce((sum, amount) => sum.plus(amount), new Decimal(0)));
    rounded[0] = rounded[0].plus(remainder);
    // Necessary precheck is NOT sufficient for unequal weights or large remainders.
    if (rounded.some(amount => !amount.gt(0) || amount.gt('999999999999999.9999'))) return fail(ALLOCATION_PRECISION_ERROR);
    if (!rounded.reduce((sum, amount) => sum.plus(amount), new Decimal(0)).eq(pool)) return fail(ALLOCATION_PRECISION_ERROR);
    drivers.forEach((row, index) => lines.push({
      productionRunId: row.id, costPurpose, driverType: OVERHEAD_ALLOCATION_DRIVER,
      driverQuantity: row.quantity.toFixed(4), totalDriver: totalDriver.toFixed(4),
      poolAmount: pool.toFixed(4), allocatedAmount: rounded[index].toFixed(4), currencyCode,
    }));
  }
  lines.sort((a, b) => a.productionRunId < b.productionRunId ? -1 : a.productionRunId > b.productionRunId ? 1 : a.costPurpose < b.costPurpose ? -1 : a.costPurpose > b.costPurpose ? 1 : 0);
  const sourceAmount = [...pools.values()].reduce((sum, amount) => sum.plus(amount), new Decimal(0));
  if (!lines.reduce((sum, line) => sum.plus(line.allocatedAmount), new Decimal(0)).eq(sourceAmount)) return fail(ALLOCATION_PRECISION_ERROR);
  return { sourceAmount: sourceAmount.toFixed(4), totalDriver: totalDriver.toFixed(4), sourceCount: sources.length, targetCount: targets.length, purposeCount: pools.size, lines };
}
