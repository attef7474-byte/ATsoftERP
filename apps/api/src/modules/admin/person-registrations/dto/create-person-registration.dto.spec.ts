import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePersonRegistrationDto } from './create-person-registration.dto';
import { transformValidationErrors } from '../../../../common/validation/validation-error-transformer';

describe('person-registration create validation', () => {
  const base = () => ({ name: ' Employee Full Name Here ', phone: '077174907', placement: { departmentId: 'department-1', effectiveFrom: '2026-11-10' } });
  const errors = async (payload: object) => transformValidationErrors(await validate(plainToInstance(CreatePersonRegistrationDto, payload), { whitelist: true, forbidNonWhitelisted: true }));
  it('accepts an omitted generated code, the reported phone, and an unambiguous date', async () => {
    expect(await errors(base())).toEqual([]);
    expect(plainToInstance(CreatePersonRegistrationDto, base()).name).toBe('Employee Full Name Here');
  });
  it.each(['', '   '])('rejects empty or whitespace-only name %p', async (name) => {
    expect(await errors({ ...base(), name })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'validation.required' })]));
  });
  it('rejects missing placement through DTO validation instead of a service 500', async () => {
    expect(await errors({ name: 'Employee' })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'placement', code: 'validation.required' })]));
  });
  it('rejects empty department', async () => {
    expect(await errors({ ...base(), placement: { departmentId: '' } })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'placement.departmentId', code: 'validation.required' })]));
  });
  it.each(['11/10/2026', '2026-02-30', 'Invalid Date'])('rejects ambiguous or invalid date %s', async (effectiveFrom) => {
    expect(await errors({ ...base(), placement: { departmentId: 'department-1', effectiveFrom } })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'placement.effectiveFrom', code: 'validation.invalidDate' })]));
  });
  it('validates both personal and login email and rejects caller tenant overrides', async () => {
    expect(await errors({ ...base(), email: 'invalid', login: { email: 'invalid' }, companyId: 'other' })).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'email', code: 'validation.invalidEmail' }),
      expect.objectContaining({ field: 'login.email', code: 'validation.invalidEmail' }),
      expect.objectContaining({ field: 'companyId', code: 'validation.unknownField' }),
    ]));
  });
});
