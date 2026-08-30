import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const ctxSeiyun = { ...ctx, contextKey: 'c1:b2:-:-', branchId: 'b2', branchName: 'Seiyun' };

const person = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  code: 'EMP-001',
  name: 'Ahmed Hassan',
  category: 'MAINTENANCE',
  isActive: true,
  phone: null,
  email: null,
  notes: null,
  ...overrides,
});

describe('EmployeesService', () => {
  let prisma: any;
  let tx: any;
  let service: EmployeesService;

  beforeEach(() => {
    tx = {
      operationalPerson: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      operationalPersonAssignment: { create: jest.fn(), count: jest.fn() },
      maintenancePersonnel: { count: jest.fn() },
      productionShiftAssignment: { count: jest.fn() },
      shiftHandover: { count: jest.fn() },
      productionRun: { count: jest.fn() },
    };

    prisma = {
      operationalPerson: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      operationalPersonAssignment: { create: jest.fn(), count: jest.fn() },
      maintenancePersonnel: { count: jest.fn() },
      productionShiftAssignment: { count: jest.fn() },
      shiftHandover: { count: jest.fn() },
      productionRun: { count: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    service = new EmployeesService(prisma);
  });

  describe('findAll (A, B, O)', () => {
    it('loads the list scoped to the active branch through current assignments', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([person()]);
      prisma.operationalPerson.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(prisma.operationalPerson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignments: {
              some: expect.objectContaining({
                companyId: 'c1',
                branchId: 'b1',
                deletedAt: null,
                effectiveFrom: { lte: expect.any(Date) },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: expect.any(Date) } }],
              }),
            },
          }),
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(result.data[0].code).toBe('EMP-001');
    });

    it('does not leak employees assigned to another branch (Seiyun isolation)', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([]);
      prisma.operationalPerson.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);

      const where = prisma.operationalPerson.findMany.mock.calls[0][0].where;
      expect(where.assignments.some.branchId).toBe('b1');
      expect(where.assignments.some.branchId).not.toBe('b2');
    });

    it('applies search on code/name/phone/email preserving branch scope', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([]);
      prisma.operationalPerson.count.mockResolvedValue(0);

      await service.findAll({ search: 'ahmed', page: 1, limit: 10 }, ctx);

      const where = prisma.operationalPerson.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(expect.arrayContaining([
        { code: { contains: 'ahmed' } },
        { name: { contains: 'ahmed' } },
        { phone: { contains: 'ahmed' } },
        { email: { contains: 'ahmed' } },
      ]));
      expect(where.assignments.some.branchId).toBe('b1');
    });

    it('filters by isActive when provided', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([]);
      prisma.operationalPerson.count.mockResolvedValue(0);

      await service.findAll({ isActive: 'false', page: 1, limit: 10 }, ctx);

      const where = prisma.operationalPerson.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });
  });

  describe('findOne (N)', () => {
    it('returns an employee with a current assignment in the active branch', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ name: 'Rania' }));

      const result = await service.findOne('p1', ctx);

      expect(prisma.operationalPerson.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', assignments: { some: expect.objectContaining({ branchId: 'b1' }) } },
        }),
      );
      expect(result.name).toBe('Rania');
    });

    it('rejects an employee from another branch by typed id (404)', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(null);

      await expect(service.findOne('foreign-person', ctxSeiyun)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create (C)', () => {
    it('creates the identity and the initial assignment in the active branch atomically', async () => {
      tx.operationalPerson.findUnique.mockResolvedValue(null);
      tx.department.findFirst.mockResolvedValue({ id: 'd1', companyId: 'c1', branchId: 'b1' });
      tx.operationalPerson.create.mockResolvedValue(person());
      tx.operationalPersonAssignment.create.mockResolvedValue({ id: 'a1' });

      const result = await service.create(
        { code: 'EMP-001', name: 'Ahmed Hassan', departmentId: 'd1' },
        ctx,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.operationalPerson.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'EMP-001', name: 'Ahmed Hassan', category: 'MAINTENANCE' }),
        }),
      );
      expect(tx.operationalPersonAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            departmentId: 'd1',
            personnelId: 'p1',
          }),
        }),
      );
      expect(result.id).toBe('p1');
    });

    it('blocks duplicate codes', async () => {
      tx.operationalPerson.findUnique.mockResolvedValue(person());

      await expect(
        service.create({ code: 'EMP-001', name: 'Ahmed', departmentId: 'd1' }, ctx),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an initial placement department outside the active branch', async () => {
      tx.operationalPerson.findUnique.mockResolvedValue(null);
      tx.department.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ code: 'EMP-002', name: 'Sara', departmentId: 'foreign' }, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (D, E, F)', () => {
    it('loads the existing record and updates the SAME id without creating a duplicate', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ id: 'p1' }));
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ id: 'p1' }));
      prisma.operationalPerson.update.mockResolvedValue(person({ name: 'Ahmed Updated', id: 'p1' }));
      prisma.operationalPerson.findFirst.mockResolvedValue(null);

      const dupCheck = prisma.operationalPerson.findFirst;
      dupCheck.mockImplementation((args: any) =>
        // second call is the code-duplicate probe
        args?.where?.code ? null : person({ id: 'p1' }),
      );

      const result = await service.update('p1', { name: 'Ahmed Updated' }, ctx);

      expect(prisma.operationalPerson.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' } }),
      );
      expect(result.id).toBe('p1');
    });

    it('forces a 404 (not create) when the employee is not in the active branch', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(null);

      await expect(service.update('p1', { name: 'X' }, ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.operationalPerson.create).not.toHaveBeenCalled();
    });
  });

  describe('activate / deactivate (G, H)', () => {
    it('deactivates an active employee preserving the record', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ isActive: true }));
      prisma.operationalPerson.update.mockResolvedValue(person({ isActive: false }));

      const result = await service.deactivate('p1', ctx);

      expect(prisma.operationalPerson.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: { isActive: false } }),
      );
      expect(result.isActive).toBe(false);
      expect(prisma.operationalPerson.delete).not.toHaveBeenCalled();
    });

    it('rejects deactivating an already-inactive employee', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ isActive: false }));

      await expect(service.deactivate('p1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('activates an inactive employee', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person({ isActive: false }));
      prisma.operationalPerson.update.mockResolvedValue(person({ isActive: true }));

      const result = await service.activate('p1', ctx);
      expect(result.isActive).toBe(true);
    });
  });

  describe('safe delete (I, J, K)', () => {
    it('hard-deletes an unreferenced employee', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person());
      tx.maintenancePersonnel.count.mockResolvedValue(0);
      tx.productionShiftAssignment.count.mockResolvedValue(0);
      tx.operationalPersonAssignment.count.mockResolvedValue(0);
      tx.shiftHandover.count.mockResolvedValue(0);
      tx.productionRun.count.mockResolvedValue(0);
      tx.operationalPerson.delete.mockResolvedValue({ id: 'p1' });

      const result = await service.remove('p1', ctx);

      expect(tx.operationalPerson.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(result.message).toContain('deleted');
    });

    it('blocks hard delete when any reference exists and does NOT delete dependents', async () => {
      prisma.operationalPerson.findFirst.mockResolvedValue(person());
      tx.maintenancePersonnel.count.mockResolvedValue(1);
      tx.productionShiftAssignment.count.mockResolvedValue(0);
      tx.operationalPersonAssignment.count.mockResolvedValue(0);
      tx.shiftHandover.count.mockResolvedValue(0);
      tx.productionRun.count.mockResolvedValue(0);

      await expect(service.remove('p1', ctx)).rejects.toThrow(BadRequestException);
      expect(tx.operationalPerson.delete).not.toHaveBeenCalled();
      expect(tx.maintenancePersonnel.count).toHaveBeenCalled();
    });
  });
});
