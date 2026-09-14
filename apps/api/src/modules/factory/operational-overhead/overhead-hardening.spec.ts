import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateOverheadEntryDto } from './dto/overhead-entry.dto';
import { OverheadPeriodQueryDto } from './dto/overhead-period.dto';
import { isOverheadAmount } from './dto/overhead-amount.validator';
import { OperationalOverheadController } from './operational-overhead.controller';
import { OperationalOverheadService } from './operational-overhead.service';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { OVERHEAD_PERMISSION_KEYS } from './operational-overhead.constants';

const validEntry = { periodId: 'p1', reference: 'R1', overheadCategory: 'UTILITIES', costPurpose: 'UTILITIES', description: 'Source', amount: '999999999999999.9999', incurredAt: '2026-01-05T00:00:00Z', sourceCostCenterId: 'cc1' };
const validateEntry = (extra: object) => validate(plainToInstance(CreateOverheadEntryDto, { ...validEntry, ...extra }), { whitelist: true, forbidNonWhitelisted: true });

describe('B1 precision and request contract', () => {
  it.each(['0', '-1', '1.00001', '1000000000000000', '1e3', '', NaN, Infinity, 100000000000])('rejects unsafe amount %s', async (amount) => {
    expect(isOverheadAmount(amount)).toBe(false);
    expect((await validateEntry({ amount })).some(e => e.property === 'amount')).toBe(true);
  });
  it.each(['0.0001', '999999999999999.9999', 120.5])('accepts exact supported amount %s', async (amount) => {
    expect(await validateEntry({ amount })).toEqual([]);
    expect(new Prisma.Decimal(String(amount)).toJSON()).toBe(String(amount));
  });
  it.each(['currencyCode', 'companyId', 'branchId', 'companyKey', 'allocationRate'])('rejects client authority override %s', async (key) => {
    expect((await validateEntry({ [key]: 'forged' })).some(e => e.property === key && e.constraints?.whitelistValidation)).toBe(true);
  });
  it.each(['BOGUS', 'MATERIAL', 'EXTERNAL_SERVICE'])('rejects invalid category %s', async (overheadCategory) => {
    expect((await validateEntry({ overheadCategory })).some(e => e.property === 'overheadCategory')).toBe(true);
  });
  it('rejects a competing cost-purpose vocabulary', async () => {
    expect((await validateEntry({ costPurpose: 'OVERHEAD' })).some(e => e.property === 'costPurpose')).toBe(true);
  });
  it('rejects an over-bound FK identifier', async () => {
    expect((await validateEntry({ sourceCostCenterId: 'x'.repeat(201) })).some(e => e.property === 'sourceCostCenterId')).toBe(true);
  });
  it('bounds list requests at 100', async () => {
    expect((await validate(plainToInstance(OverheadPeriodQueryDto, { limit: 101 }))).some(e => e.property === 'limit')).toBe(true);
  });
});
describe('B1 controller permission enforcement', () => {
  const methods = Object.getOwnPropertyNames(OperationalOverheadController.prototype).filter(n => n !== 'constructor');
  it('protects all 13 handlers with canonical B1 permissions', () => {
    expect(methods).toHaveLength(13);
    for (const method of methods) {
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, (OperationalOverheadController.prototype as any)[method]);
      expect(permissions).toHaveLength(1);
      expect(Object.values(OVERHEAD_PERMISSION_KEYS)).toContain(permissions[0]);
    }
  });
  it.each(methods)('denies and permits %s using the real PermissionsGuard', async (method) => {
    const handler = (OperationalOverheadController.prototype as any)[method];
    const key = Reflect.getMetadata(PERMISSIONS_KEY, handler)[0];
    const db: any = { userRole: { findMany: jest.fn().mockResolvedValue([]) } };
    const guard = new PermissionsGuard(new Reflector(), db);
    const context: any = { getHandler: () => handler, getClass: () => OperationalOverheadController, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) };
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    db.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'OVERHEAD_OPERATOR', permissions: [{ permission: { key, status: 'ACTIVE' } }] } }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    db.userRole.findMany.mockResolvedValue([{ role: { status: 'INACTIVE', code: 'OVERHEAD_OPERATOR', permissions: [{ permission: { key, status: 'ACTIVE' } }] } }]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('B1 shared mutation lock', () => {
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const periodMutations: [string, any[]][] = [
    ['createPeriod', [{ code: 'P', periodFrom: '2026-01-01', periodTo: '2026-02-01' }, 'u', ctx]],
    ['updatePeriod', ['p', { code: 'P' }, 'u', ctx]],
    ['openPeriod', ['p', {}, 'u', ctx]],
    ['closePeriod', ['p', {}, 'u', ctx]],
    ['cancelPeriod', ['p', 'u', ctx]],
    ['createEntry', [validEntry, 'u', ctx]],
  ];
  it.each(periodMutations)('%s rejects lock acquisition failure before any state read or write', async (method, args) => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: -999 }]),
      $transaction: jest.fn((fn: any) => fn(db)),
      operationalOverheadPeriod: { findFirst: jest.fn() },
      operationalOverheadEntry: { findFirst: jest.fn() },
    };
    const service: any = new OperationalOverheadService(db, {} as any);
    await expect(service[method](...args)).rejects.toBeInstanceOf(ConflictException);
    expect(db.operationalOverheadPeriod.findFirst).not.toHaveBeenCalled();
    expect(db.operationalOverheadEntry.findFirst).not.toHaveBeenCalled();
  });
  const entryMutations: [string, any[]][] = [
    ['updateEntry', ['e', { reference: 'R2' }, 'u', ctx]],
    ['finalizeEntry', ['e', {}, 'u', ctx]],
    ['deleteEntry', ['e', 'u', ctx]],
  ];
  it.each(entryMutations)('%s rejects lock acquisition failure before any state write', async (method, args) => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: -999 }]),
      $transaction: jest.fn((fn: any) => fn(db)),
      operationalOverheadPeriod: { findFirst: jest.fn() },
      operationalOverheadEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'e', periodId: 'p1', status: 'DRAFT', currencyCode: 'USD' }),
        update: jest.fn(),
      },
    };
    const service: any = new OperationalOverheadService(db, {} as any);
    await expect(service[method](...args)).rejects.toBeInstanceOf(ConflictException);
    expect(db.operationalOverheadEntry.update).not.toHaveBeenCalled();
    expect(db.operationalOverheadPeriod.findFirst).not.toHaveBeenCalled();
  });
  it('date edits reject overlap with another DRAFT period', async () => {
    const db: any = { $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]), $transaction: jest.fn((fn: any) => fn(db)), operationalOverheadPeriod: {
      findFirst: jest.fn().mockResolvedValueOnce({ id: 'p', status: 'DRAFT', periodFrom: new Date('2026-01-01'), periodTo: new Date('2026-02-01') }).mockResolvedValueOnce({ id: 'other', status: 'DRAFT' }),
      update: jest.fn(),
    } };
    await expect(new OperationalOverheadService(db, {} as any).updatePeriod('p', { periodTo: '2026-03-01' }, 'u', ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(db.operationalOverheadPeriod.findFirst.mock.calls[1][0].where.status.in).toContain('DRAFT');
    expect(db.operationalOverheadPeriod.update).not.toHaveBeenCalled();
  });
});
