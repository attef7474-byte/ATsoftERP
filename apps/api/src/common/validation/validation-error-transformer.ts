import { ValidationError } from '@nestjs/common';

export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
  params?: Record<string, unknown>;
}

const REQUIRED_CONSTRAINTS = new Set([
  'isnotempty',
  'isdefined',
  'isnotemptyobject',
  'arraynotempty',
  'notempty',
]);

const NUMBER_CONSTRAINTS = new Set([
  'isint',
  'isnumber',
  'ispositive',
  'isnegative',
  'ismin',
  'ismax',
  'isnumberstring',
  'isdecimal',
  'isdivisibleby',
]);

export function mapValidationConstraint(constraint: string): string {
  const name = constraint.toLowerCase();
  if (REQUIRED_CONSTRAINTS.has(name)) return 'validation.required';
  if (name === 'isenum' || name === 'isin') return 'validation.invalidEnum';
  if (name === 'isdate' || name === 'isiso8601') return 'validation.invalidDate';
  if (name === 'isuuid' || name === 'ismongoid' || name === 'isnan') return 'validation.invalidId';
  if (NUMBER_CONSTRAINTS.has(name)) return 'validation.invalidNumber';
  if (name === 'isemail') return 'validation.invalidEmail';
  if (name === 'minlength') return 'validation.tooShort';
  if (name === 'maxlength') return 'validation.tooLong';
  if (name === 'length') return 'validation.tooShort';
  if (name === 'matches') return 'validation.invalidFormat';
  if (name === 'whitelistvalidation') return 'validation.unknownField';
  return 'validation.invalidValue';
}

export function transformValidationErrors(errors: ValidationError[], basePath = ''): ApiFieldError[] {
  const result: ApiFieldError[] = [];
  for (const error of errors) {
    const fieldPath = basePath ? `${basePath}.${error.property}` : error.property;
    if (error.constraints) {
      for (const [constraint, message] of Object.entries(error.constraints)) {
        result.push({
          field: fieldPath,
          code: mapValidationConstraint(constraint),
          message,
        });
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...transformValidationErrors(error.children, fieldPath));
    }
  }
  return result;
}
