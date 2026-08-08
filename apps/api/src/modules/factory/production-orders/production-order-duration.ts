import { Prisma } from '@prisma/client';

export interface PlannedDurationInput {
  plannedQuantity: Prisma.Decimal.Value;
  standardRate: Prisma.Decimal.Value;
  timeBasis: 'MINUTE' | 'HOUR';
  targetEfficiencyPercent: Prisma.Decimal.Value;
  expectedYieldPercent: Prisma.Decimal.Value;
  setupMinutes: Prisma.Decimal.Value;
  changeoverMinutes: Prisma.Decimal.Value;
  cleaningMinutes: Prisma.Decimal.Value;
  startupAllowanceMinutes: Prisma.Decimal.Value;
  shutdownAllowanceMinutes: Prisma.Decimal.Value;
}

export interface PlannedDurationResult {
  plannedGrossQuantity: Prisma.Decimal;
  plannedRunMinutes: Prisma.Decimal;
  plannedAllowanceMinutes: Prisma.Decimal;
  plannedDurationMinutes: Prisma.Decimal;
  calculationVersion: 'PHASE_1_4_V1';
}

export function calculatePlannedDuration(input: PlannedDurationInput): PlannedDurationResult {
  const quantity = new Prisma.Decimal(input.plannedQuantity);
  const rate = new Prisma.Decimal(input.standardRate);
  const efficiency = new Prisma.Decimal(input.targetEfficiencyPercent);
  const expectedYield = new Prisma.Decimal(input.expectedYieldPercent);
  if (!quantity.greaterThan(0)) throw new Error('PLANNED_QUANTITY_NOT_POSITIVE');
  if (!rate.greaterThan(0)) throw new Error('STANDARD_RATE_NOT_POSITIVE');
  if (!efficiency.greaterThan(0) || efficiency.greaterThan(100)) throw new Error('EFFICIENCY_OUT_OF_RANGE');
  if (!expectedYield.greaterThan(0) || expectedYield.greaterThan(100)) throw new Error('YIELD_OUT_OF_RANGE');

  const hundred = new Prisma.Decimal(100);
  const grossQuantity = quantity.div(expectedYield.div(hundred));
  const basisMinutes = input.timeBasis === 'HOUR' ? new Prisma.Decimal(60) : new Prisma.Decimal(1);
  const runMinutes = grossQuantity.div(rate).mul(basisMinutes).div(efficiency.div(hundred));
  const allowances = [
    input.setupMinutes,
    input.changeoverMinutes,
    input.cleaningMinutes,
    input.startupAllowanceMinutes,
    input.shutdownAllowanceMinutes,
  ].reduce<Prisma.Decimal>((total, value) => total.add(new Prisma.Decimal(value)), new Prisma.Decimal(0));
  if (allowances.isNegative()) throw new Error('ALLOWANCE_NOT_NON_NEGATIVE');

  const round = (value: Prisma.Decimal) => value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  return {
    plannedGrossQuantity: round(grossQuantity),
    plannedRunMinutes: round(runMinutes),
    plannedAllowanceMinutes: round(allowances),
    plannedDurationMinutes: round(runMinutes.add(allowances)),
    calculationVersion: 'PHASE_1_4_V1',
  };
}
