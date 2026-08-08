import { Prisma } from '@prisma/client';

export const PRODUCTION_LOSS_TYPES = ['WASTE', 'SCRAP', 'REWORK_SENT', 'REWORK_RECOVERED'] as const;

export type ProductionLossType = (typeof PRODUCTION_LOSS_TYPES)[number];

export function isProductionLossType(value: string): value is ProductionLossType {
  return (PRODUCTION_LOSS_TYPES as readonly string[]).includes(value);
}

export function isPositiveQuantity(value: Prisma.Decimal | string | number): boolean {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
  return decimal.greaterThan(0);
}

/** A governed reason must belong to a compatible loss category for the event type. */
export function categoryCompatible(type: string, lossCategory: string | null | undefined): boolean {
  if (!lossCategory) return true;
  if (type === 'WASTE') return lossCategory === 'WASTE';
  if (type === 'SCRAP') return lossCategory === 'SCRAP';
  if (type === 'REWORK_SENT' || type === 'REWORK_RECOVERED') return lossCategory === 'REWORK';
  return true;
}

/** Outstanding recoverable quantity after all effective recoveries are counted. */
export function computeOutstandingRecoverable(sentQuantity: Prisma.Decimal | string | number, recoveredQuantities: Array<Prisma.Decimal | string | number>): Prisma.Decimal {
  const sent = sentQuantity instanceof Prisma.Decimal ? sentQuantity : new Prisma.Decimal(String(sentQuantity));
  let outstanding = sent;
  for (const recovered of recoveredQuantities) {
    const amount = recovered instanceof Prisma.Decimal ? recovered : new Prisma.Decimal(String(recovered));
    outstanding = outstanding.minus(amount);
  }
  if (outstanding.lessThan(0)) return new Prisma.Decimal(0);
  return outstanding;
}
