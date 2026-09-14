import { Prisma } from '@prisma/client';
import { ValidateBy, ValidationOptions } from 'class-validator';

/** Decimal text is the full-precision API form. Small legacy numeric inputs remain supported. */
export function isOverheadAmount(value: unknown): value is string | number {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  if (typeof value === 'number' && (!Number.isFinite(value) || value > 9999999999.9999)) return false;
  const text = String(value);
  if (!/^\d{1,15}(\.\d{1,4})?$/.test(text)) return false;
  const amount = new Prisma.Decimal(text);
  return amount.isFinite() && amount.gt(0) && amount.lte('999999999999999.9999');
}
export function IsOverheadAmount(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isOverheadAmount',
    validator: {
      validate: isOverheadAmount,
      defaultMessage: () => 'overhead.amountInvalid',
    },
  }, options);
}
