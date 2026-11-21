import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FullPersonName, YemenPhone, normalizeIdentity, normalizePersonName, normalizeYemenPhone,
  assertIdentityAvailable, lockIdentityCompany } from './person-identity';
import { transformValidationErrors } from './validation-error-transformer';
import { CreateEmployeeDto } from '../../modules/admin/employees/dto/create-employee.dto';
import { CreateUserDto } from '../../modules/admin/users/dto/create-user.dto';
import { CreatePersonRegistrationDto } from '../../modules/admin/person-registrations/dto/create-person-registration.dto';
import { CreateMaintenancePersonnelDto } from '../../modules/factory/maintenance/maintenance-personnel/dto/create-maintenance-personnel.dto';

class Identity { @FullPersonName() name: string; @YemenPhone() phone: string; }
const ctx: any = { companyId: 'company-a', branchId: 'branch-a' };
describe('person identity policy', () => {
  it.each(['عاطف علي', 'عاطف علي عبدالله', '', '   '])('rejects short full name %p in service', name => {
    expect(() => normalizeIdentity({ name })).toThrow(BadRequestException);
  });
  it.each(['عاطف علي عبدالله زيد', 'Ali Hassan Ahmed Saleh', 'Ali Hassan Ahmed Saleh Zaid'])('accepts four or more words %p', name => {
    expect(normalizeIdentity({ name }).name).toBe(name);
  });
  it('collapses all whitespace and preserves Arabic letters exactly', () => {
    expect(normalizePersonName('  أحمد\tإبراهيم\nعلي   عبدالله  ')).toBe('أحمد إبراهيم علي عبدالله');
  });
  it.each(['77174977', '7717497760', '77a749776', '771 749776', '+968771749776', ' 771749776', '771749776 ', '٧٧١٧٤٩٧٧٦'])('rejects malformed Yemen phone %p', phone => {
    expect(() => normalizeYemenPhone(phone)).toThrow(BadRequestException);
  });
  it.each(['771749776', '+967771749776', '00967771749776'])('normalizes %p to the same canonical phone', phone => {
    expect(normalizeYemenPhone(phone)).toBe('+967771749776');
  });
  it.each(['734053717', '700600123', '711255777', '123456789'])('has no carrier restriction for %p', phone => {
    expect(normalizeYemenPhone(phone)).toBe(`+967${phone}`);
  });
  it.each([null, undefined, ''])('keeps an optional phone empty %p', phone => expect(normalizeYemenPhone(phone)).toBeNull());
  it('emits localized DTO field codes', async () => {
    const errors = transformValidationErrors(await validate(plainToInstance(Identity, { name: 'One Two Three', phone: 'letters' })));
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'name', code: 'validation.personFullName' }),
      expect.objectContaining({ field: 'phone', code: 'validation.yemenPhone' }),
    ]));
  });
  it.each([CreateEmployeeDto, CreateUserDto, CreatePersonRegistrationDto, CreateMaintenancePersonnelDto])('rejects identity bypass through %p', async (Dto: any) => {
    const errors = transformValidationErrors(await validate(plainToInstance(Dto, { name: 'One Two Three', phone: 'abcdefgh9' })));
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'name', code: 'validation.personFullName' }),
      expect.objectContaining({ field: 'phone', code: 'validation.yemenPhone' }),
    ]));
  });
  it('locks the company with a bound parameter, and rejects missing context', async () => {
    const tx: any = { $queryRaw: jest.fn().mockResolvedValue([{ id: ctx.companyId }]) };
    await lockIdentityCompany(tx, ctx);
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([ctx.companyId]);
    expect(tx.$queryRaw.mock.calls[0][0].strings.join('')).toContain('UPDLOCK, HOLDLOCK');
    await expect(lockIdentityCompany(tx, {} as any)).rejects.toThrow(ForbiddenException);
  });
  it.each(['user', 'operationalPerson'] as const)('finds normalized legacy duplicates within %s only', async authority => {
    const tx: any = { [authority]: { findMany: jest.fn().mockResolvedValue([{ id: 'other', name: ' Ali\tHassan Ahmed  Saleh ', phone: '00967771749776' }]) } };
    await expect(assertIdentityAvailable(tx, authority, { name: 'Ali Hassan Ahmed Saleh' }, ctx)).rejects.toThrow(ConflictException);
    await expect(assertIdentityAvailable(tx, authority, { phone: '+967771749776' }, ctx)).rejects.toThrow(ConflictException);
    expect(tx[authority].findMany.mock.calls[0][0].where).toEqual(authority === 'user'
      ? { companyId: ctx.companyId, deletedAt: null }
      : { assignments: { some: { companyId: ctx.companyId, deletedAt: null } } });
  });
  it('excludes the edited identity and keeps malformed legacy rows readable', async () => {
    const tx: any = { operationalPerson: { findMany: jest.fn().mockResolvedValue([{ id: 'other', name: 'Different Person Full Name', phone: 'legacy-invalid' }]) } };
    await assertIdentityAvailable(tx, 'operationalPerson', { name: 'Ali Hassan Ahmed Saleh', phone: '771749776' }, ctx, 'self');
    expect(tx.operationalPerson.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: 'self' } }), take: 250 }));
  });
  it('compares across bounded pages instead of dropping legacy matches after page one', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ id: String(i), name: 'Different Person Full Name', phone: null }));
    const tx: any = { user: { findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([{ id: 'last', name: 'Ali Hassan Ahmed Saleh', phone: null }]) } };
    await expect(assertIdentityAvailable(tx, 'user', { name: 'Ali Hassan Ahmed Saleh' }, ctx)).rejects.toThrow(ConflictException);
    expect(tx.user.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: '249' }, skip: 1, take: 250 });
  });
});
