import { ValidationError } from '@nestjs/common';
import {
  mapValidationConstraint,
  transformValidationErrors,
} from './validation-error-transformer';

function constraint(name: string, message = `${name} failed`): ValidationError {
  return { property: 'testField', constraints: { [name]: message } } as ValidationError;
}

describe('mapValidationConstraint', () => {
  it('maps required-family constraints to validation.required', () => {
    for (const name of ['isNotEmpty', 'isDefined', 'isNotEmptyObject', 'arrayNotEmpty']) {
      expect(mapValidationConstraint(name)).toBe('validation.required');
    }
  });

  it('maps enum constraints to validation.invalidEnum', () => {
    expect(mapValidationConstraint('isEnum')).toBe('validation.invalidEnum');
    expect(mapValidationConstraint('isIn')).toBe('validation.invalidEnum');
  });

  it('maps date and id constraints', () => {
    expect(mapValidationConstraint('isDate')).toBe('validation.invalidDate');
    expect(mapValidationConstraint('isISO8601')).toBe('validation.invalidDate');
    expect(mapValidationConstraint('isUUID')).toBe('validation.invalidId');
    expect(mapValidationConstraint('isMongoId')).toBe('validation.invalidId');
  });

  it('maps number constraints to validation.invalidNumber', () => {
    for (const name of ['isInt', 'isNumber', 'isPositive', 'isMin', 'isMax', 'isDecimal']) {
      expect(mapValidationConstraint(name)).toBe('validation.invalidNumber');
    }
  });

  it('maps email, length, matches, and whitelist constraints', () => {
    expect(mapValidationConstraint('isEmail')).toBe('validation.invalidEmail');
    expect(mapValidationConstraint('minLength')).toBe('validation.tooShort');
    expect(mapValidationConstraint('maxLength')).toBe('validation.tooLong');
    expect(mapValidationConstraint('matches')).toBe('validation.invalidFormat');
    expect(mapValidationConstraint('whitelistValidation')).toBe('validation.unknownField');
  });

  it('falls back to validation.invalidValue for unknown constraints', () => {
    expect(mapValidationConstraint('isCustomThing')).toBe('validation.invalidValue');
  });
});

describe('transformValidationErrors', () => {
  it('transforms a flat error into a canonical field entry', () => {
    const result = transformValidationErrors([constraint('isNotEmpty', 'must not be empty')]);
    expect(result).toEqual([{ field: 'testField', code: 'validation.required', message: 'must not be empty' }]);
  });

  it('keeps the original constraint message text', () => {
    const result = transformValidationErrors([constraint('isEnum', 'must be a valid enum value')]);
    expect(result[0].message).toBe('must be a valid enum value');
  });

  it('builds nested paths for child objects', () => {
    const nested: ValidationError = {
      property: 'address',
      children: [constraint('isString')],
    } as ValidationError;
    const result = transformValidationErrors([nested]);
    expect(result[0].field).toBe('address.testField');
  });

  it('builds array index paths for nested arrays', () => {
    const lineItem: ValidationError = {
      property: '0',
      children: [
        {
          property: 'quantity',
          constraints: { isInt: 'must be an integer' },
        } as ValidationError,
      ],
    } as ValidationError;
    const lines: ValidationError = {
      property: 'lines',
      children: [lineItem],
    } as ValidationError;
    const result = transformValidationErrors([lines]);
    expect(result[0].field).toBe('lines.0.quantity');
    expect(result[0].code).toBe('validation.invalidNumber');
  });

  it('emits one entry per constraint on the same field', () => {
    const multi: ValidationError = {
      property: 'name',
      constraints: { isNotEmpty: 'required', maxLength: 'too long' },
    } as ValidationError;
    const result = transformValidationErrors([multi]);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.code)).toEqual(['validation.required', 'validation.tooLong']);
  });

  it('returns an empty array for no errors', () => {
    expect(transformValidationErrors([])).toEqual([]);
  });
});
