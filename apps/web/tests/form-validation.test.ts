import {
  getValueAtPath,
  setValueAtPath,
  hasValueAtPath,
  errorsToFieldMap,
  filterStaleErrors,
  findFirstInvalidField,
  focusFirstInvalidField,
  mapEntityIdField,
  adaptFieldErrorsToMap,
} from '../src/lib/form-validation';
import { ApiFieldError } from '../src/lib/error-utils';

describe('getValueAtPath', () => {
  it('reads top-level, nested, and array paths', () => {
    const source = { name: 'A', address: { city: 'Cairo' }, lines: [{ quantity: 5 }] };
    expect(getValueAtPath(source, 'name')).toBe('A');
    expect(getValueAtPath(source, 'address.city')).toBe('Cairo');
    expect(getValueAtPath(source, 'lines.0.quantity')).toBe(5);
  });

  it('returns undefined for missing paths', () => {
    expect(getValueAtPath({ a: 1 }, 'b.c')).toBeUndefined();
    expect(getValueAtPath(null, 'a')).toBeUndefined();
  });
});

describe('setValueAtPath', () => {
  it('creates intermediate objects and sets the leaf', () => {
    const source: Record<string, unknown> = {};
    setValueAtPath(source, 'address.city', 'Giza');
    expect(source).toEqual({ address: { city: 'Giza' } });
  });

  it('overwrites an existing leaf', () => {
    const source: Record<string, unknown> = { name: 'A' };
    setValueAtPath(source, 'name', 'B');
    expect(source.name).toBe('B');
  });
});

describe('hasValueAtPath', () => {
  it('returns false for empty strings and missing values', () => {
    expect(hasValueAtPath({ name: '' }, 'name')).toBe(false);
    expect(hasValueAtPath({ name: undefined }, 'name')).toBe(false);
    expect(hasValueAtPath({}, 'name')).toBe(false);
  });

  it('returns true for filled values', () => {
    expect(hasValueAtPath({ name: 'x' }, 'name')).toBe(true);
    expect(hasValueAtPath({ lines: [{ qty: 1 }] }, 'lines.0.qty')).toBe(true);
  });
});

describe('errorsToFieldMap', () => {
  it('maps field errors to a record, keeping the first message per field', () => {
    const errors: ApiFieldError[] = [
      { field: 'name', message: 'required' },
      { field: 'name', message: 'second' },
      { field: 'lines.0.qty', message: 'invalid' },
    ];
    expect(errorsToFieldMap(errors)).toEqual({ name: 'required', 'lines.0.qty': 'invalid' });
  });

  it('returns an empty record for no errors', () => {
    expect(errorsToFieldMap(undefined)).toEqual({});
  });
});

describe('filterStaleErrors', () => {
  it('drops field errors whose fields are now filled', () => {
    const errors: ApiFieldError[] = [
      { field: 'name', message: 'required' },
      { field: 'city', message: 'required' },
      { field: 'meta', message: 'global' },
    ];
    const result = filterStaleErrors(errors, { name: 'filled', city: '' });
    expect(result).toEqual([{ field: 'city', message: 'required' }, { field: 'meta', message: 'global' }]);
  });

  it('returns undefined when nothing remains', () => {
    const result = filterStaleErrors([{ field: 'name', message: 'required' }], { name: 'x' });
    expect(result).toBeUndefined();
  });

  it('returns undefined for no errors', () => {
    expect(filterStaleErrors(undefined, {})).toBeUndefined();
  });
});

describe('findFirstInvalidField', () => {
  it('returns the first field with a path', () => {
    expect(findFirstInvalidField([{ field: 'b', message: 'x' }, { field: 'a', message: 'y' }])).toBe('b');
  });

  it('returns undefined for no errors', () => {
    expect(findFirstInvalidField(undefined)).toBeUndefined();
  });
});

describe('focusFirstInvalidField', () => {
  it('returns safely when the document is unavailable', () => {
    expect(() => focusFirstInvalidField([{ field: 'title', message: 'required' }])).not.toThrow();
  });

  it('does not throw when no element matches', () => {
    expect(() => focusFirstInvalidField([{ field: 'nope.nothing', message: 'x' }])).not.toThrow();
  });
});

describe('mapEntityIdField', () => {
  it('maps entityId fields to their lookup counterpart', () => {
    expect(mapEntityIdField('companyId')).toBe('companyIdLookup');
    expect(mapEntityIdField('id')).toBe('id');
  });
});

describe('adaptFieldErrorsToMap', () => {
  it('applies an id-field map to server paths', () => {
    const errors: ApiFieldError[] = [{ field: 'machineId', message: 'required' }];
    expect(adaptFieldErrorsToMap(errors, { machineId: 'machineIdLookup' })).toEqual({ machineIdLookup: 'required' });
  });

  it('keeps unmapped paths as-is', () => {
    const errors: ApiFieldError[] = [{ field: 'title', message: 'required' }];
    expect(adaptFieldErrorsToMap(errors, {})).toEqual({ title: 'required' });
  });
});
