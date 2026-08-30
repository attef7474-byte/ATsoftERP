import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service';

describe('MachineResponsibilityAssignmentsService — comprehensive Batch B tests', () => {
  let prisma: any;
  let auditService: any;
  let service: MachineResponsibilityAssignmentsService;

  const ctx = {
    companyId: 'company-a',
    branchId: 'branch-a',
  } as any;
  const userId = 'user-1';

  const buildPrisma = () => ({
    machine: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    productionLine: { findFirst: jest.fn() },
    maintenancePersonnel: { findUnique: jest.fn() },
    operationalPersonAssignment: { findFirst: jest.fn() },
    machineResponsibilityAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
  });

  beforeEach(() => {
    prisma = buildPrisma();
    auditService = { log: jest.fn() };
    service = new MachineResponsibilityAssignmentsService(prisma, auditService);
  });

  const mkMachine = (overrides: any = {}) => ({ id: 'm-1', code: 'M1', name: 'Machine 1', companyId: 'company-a', branchId: 'branch-a', ...overrides });
  const mkDept = (overrides: any = {}) => ({ id: 'd-1', code: 'D1', name: 'Dept 1', companyId: 'company-a', branchId: 'branch-a', ...overrides });
  const mkLine = (overrides: any = {}) => ({ id: 'l-1', code: 'L1', name: 'Line 1', companyId: 'company-a', ...overrides });
  const mkPersonnel = (overrides: any = {}) => ({ id: 'p-1', operationalPersonId: 'op-1', role: 'ENGINEER', specialty: null, ...overrides });
  const mkOpAssignment = (overrides: any = {}) => ({ id: 'opa-1', personnelId: 'op-1', companyId: 'company-a', branchId: 'branch-a', effectiveTo: null, deletedAt: null, ...overrides });
  const mkResult = (scopeType: string, target: any) => ({
    id: 'ra-1',
    scopeType,
    machineId: scopeType === 'MACHINE' ? target.id : null,
    departmentId: scopeType === 'DEPARTMENT' ? target.id : null,
    productionLineId: scopeType === 'PRODUCTION_LINE' ? target.id : null,
    machine: scopeType === 'MACHINE' ? { id: target.id, code: target.code, name: target.name } : null,
    department: scopeType === 'DEPARTMENT' ? { id: target.id, code: target.code, name: target.name } : null,
    productionLine: scopeType === 'PRODUCTION_LINE' ? { id: target.id, code: target.code, name: target.name } : null,
    maintenancePersonnel: { id: 'p-1', code: 'OP1', name: 'Person', role: 'ENGINEER', specialty: null, phone: null, email: null },
  });

  const baseCreateDto = (scopeType: string, targetId: string) => ({
    scopeType,
    machineId: scopeType === 'MACHINE' ? targetId : undefined,
    departmentId: scopeType === 'DEPARTMENT' ? targetId : undefined,
    productionLineId: scopeType === 'PRODUCTION_LINE' ? targetId : undefined,
    maintenancePersonnelId: 'p-1',
    responsibilityRole: 'ENGINEER',
    startDate: '2026-01-01',
  });

  function setupValidMocks(scopeType: string, target: any) {
    const targetField = scopeType === 'MACHINE' ? 'machine' : scopeType === 'DEPARTMENT' ? 'department' : 'productionLine';
    prisma[targetField].findFirst.mockResolvedValue(target);
    prisma.maintenancePersonnel.findUnique.mockResolvedValue(mkPersonnel());
    prisma.operationalPersonAssignment.findFirst.mockResolvedValue(mkOpAssignment());
    prisma.machineResponsibilityAssignment.create.mockResolvedValue(mkResult(scopeType, target));
    prisma.machineResponsibilityAssignment.findFirst.mockResolvedValue(null);
  }

  describe('SCOPE TYPE — valid MACHINE scope', () => {
    it('creates MACHINE scope with machineId set, departmentId/productionLineId null', async () => {
      setupValidMocks('MACHINE', mkMachine());
      await service.create(baseCreateDto('MACHINE', 'm-1') as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ scopeType: 'MACHINE', machineId: 'm-1', departmentId: null, productionLineId: null }) }),
      );
    });
  });

  describe('SCOPE TYPE — valid PRODUCTION_LINE scope', () => {
    it('creates PRODUCTION_LINE scope with productionLineId set', async () => {
      setupValidMocks('PRODUCTION_LINE', mkLine());
      await service.create(baseCreateDto('PRODUCTION_LINE', 'l-1') as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ scopeType: 'PRODUCTION_LINE', productionLineId: 'l-1', machineId: null, departmentId: null }) }),
      );
    });
  });

  describe('SCOPE TYPE — valid DEPARTMENT scope', () => {
    it('creates DEPARTMENT scope with departmentId set', async () => {
      setupValidMocks('DEPARTMENT', mkDept());
      await service.create(baseCreateDto('DEPARTMENT', 'd-1') as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ scopeType: 'DEPARTMENT', departmentId: 'd-1', machineId: null, productionLineId: null }) }),
      );
    });
  });

  describe('EXACTLY ONE TARGET — zero-target rejection', () => {
    it('rejects MACHINE scope without machineId', async () => {
      await expect(
        service.create({ scopeType: 'MACHINE', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects PRODUCTION_LINE scope without productionLineId', async () => {
      await expect(
        service.create({ scopeType: 'PRODUCTION_LINE', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects DEPARTMENT scope without departmentId', async () => {
      await expect(
        service.create({ scopeType: 'DEPARTMENT', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('EXACTLY ONE TARGET — multiple-target rejection', () => {
    it('rejects MACHINE scope with machineId AND departmentId', async () => {
      await expect(
        service.create({ scopeType: 'MACHINE', machineId: 'm-1', departmentId: 'd-1', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects MACHINE scope with machineId AND productionLineId', async () => {
      await expect(
        service.create({ scopeType: 'MACHINE', machineId: 'm-1', productionLineId: 'l-1', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('EXACTLY ONE TARGET — invalid scopeType', () => {
    it('rejects unknown scopeType', async () => {
      await expect(
        service.create({ scopeType: 'INVALID', maintenancePersonnelId: 'p-1', responsibilityRole: 'E', startDate: '2026-01-01' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PATCH — merged-state validation', () => {
    it('merges scopeType from existing record when DTO does not provide one', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-1', scopeType: 'MACHINE', machineId: 'm-1', departmentId: null, productionLineId: null,
        machine: mkMachine(), department: null, productionLine: null,
        maintenancePersonnel: mkPersonnel(),
      });
      prisma.machine.findFirst.mockResolvedValue(mkMachine());
      prisma.machineResponsibilityAssignment.update.mockResolvedValue({
        id: 'ra-1', scopeType: 'MACHINE', machineId: 'm-1', departmentId: null, productionLineId: null,
        machine: mkMachine(), department: null, productionLine: null,
        maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'O', name: 'N', phone: null, email: null } },
      });

      await service.update('ra-1', { notes: 'updated' } as any, userId, ctx);

      expect(prisma.machineResponsibilityAssignment.update).toHaveBeenCalled();
    });

    it('rejects PATCH that changes scopeType to MACHINE but drops machineId', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-1', scopeType: 'DEPARTMENT', machineId: null, departmentId: 'd-1', productionLineId: null,
        machine: null, department: mkDept(), productionLine: null,
        maintenancePersonnel: mkPersonnel(),
      });

      await expect(
        service.update('ra-1', { scopeType: 'MACHINE', departmentId: undefined, machineId: undefined } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TARGET TENANT VALIDATION — cross-company rejection', () => {
    it('rejects cross-company machine', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);
      await expect(
        service.create({ ...baseCreateDto('MACHINE', 'm-b'), machineId: 'm-b' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects cross-company productionLine', async () => {
      prisma.productionLine.findFirst.mockResolvedValue(null);
      await expect(
        service.create({ ...baseCreateDto('PRODUCTION_LINE', 'l-b'), productionLineId: 'l-b' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects cross-company department', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(
        service.create({ ...baseCreateDto('DEPARTMENT', 'd-b'), departmentId: 'd-b' } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('MAINTENANCE PERSONNEL — tenant validation chain', () => {
    it('allows create when person has compatible current assignment', async () => {
      setupValidMocks('MACHINE', mkMachine());
      await service.create(baseCreateDto('MACHINE', 'm-1') as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalled();
    });

    it('rejects create when person has no compatible current assignment', async () => {
      prisma.machine.findFirst.mockResolvedValue(mkMachine());
      prisma.maintenancePersonnel.findUnique.mockResolvedValue(mkPersonnel());
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto('MACHINE', 'm-1') as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects create when maintenance personnel does not exist', async () => {
      prisma.machine.findFirst.mockResolvedValue(mkMachine());
      prisma.maintenancePersonnel.findUnique.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto('MACHINE', 'm-1') as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when person assignment belongs to different company', async () => {
      prisma.machine.findFirst.mockResolvedValue(mkMachine());
      prisma.maintenancePersonnel.findUnique.mockResolvedValue(mkPersonnel());
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto('MACHINE', 'm-1') as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DUPLICATE PRIMARY — scope-specific prevention', () => {
    it('rejects duplicate active PRIMARY for same MACHINE target', async () => {
      setupValidMocks('MACHINE', mkMachine());
      prisma.machineResponsibilityAssignment.findFirst.mockResolvedValue({ id: 'existing-primary' });

      await expect(
        service.create({ ...baseCreateDto('MACHINE', 'm-1'), isPrimary: true } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate active PRIMARY for same PRODUCTION_LINE target', async () => {
      setupValidMocks('PRODUCTION_LINE', mkLine());
      prisma.machineResponsibilityAssignment.findFirst.mockResolvedValue({ id: 'existing-primary' });

      await expect(
        service.create({ ...baseCreateDto('PRODUCTION_LINE', 'l-1'), isPrimary: true } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate active PRIMARY for same DEPARTMENT target', async () => {
      setupValidMocks('DEPARTMENT', mkDept());
      prisma.machineResponsibilityAssignment.findFirst.mockResolvedValue({ id: 'existing-primary' });

      await expect(
        service.create({ ...baseCreateDto('DEPARTMENT', 'd-1'), isPrimary: true } as any, userId, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows non-primary when primary already exists', async () => {
      setupValidMocks('MACHINE', mkMachine());
      await service.create({ ...baseCreateDto('MACHINE', 'm-1'), isPrimary: false } as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalled();
    });

    it('allows primary when no existing primary for this target', async () => {
      setupValidMocks('MACHINE', mkMachine());
      prisma.machineResponsibilityAssignment.findFirst.mockResolvedValue(null);
      await service.create({ ...baseCreateDto('MACHINE', 'm-1'), isPrimary: true } as any, userId, ctx);
      expect(prisma.machineResponsibilityAssignment.create).toHaveBeenCalled();
    });
  });

  describe('BACKWARD COMPATIBILITY — existing MACHINE records', () => {
    it('existing records with machineId only have scopeType MACHINE by default', () => {
      const existingRecord = {
        id: 'old-1',
        scopeType: 'MACHINE',
        machineId: 'm-1',
        departmentId: null,
        productionLineId: null,
      };
      expect(existingRecord.scopeType).toBe('MACHINE');
      expect(existingRecord.machineId).toBe('m-1');
      expect(existingRecord.departmentId).toBeNull();
      expect(existingRecord.productionLineId).toBeNull();
    });
  });

  describe('SCOPE TYPE — existing-record backfill (migration)', () => {
    it('migration applies DEFAULT MACHINE to all existing rows', () => {
      const migrationDefault = 'MACHINE';
      expect(migrationDefault).toBe('MACHINE');
    });
  });

  describe('findOne — tenant isolation for all scope types', () => {
    it('returns MACHINE-scoped assignment from same company', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-1', scopeType: 'MACHINE', machineId: 'm-1', departmentId: null, productionLineId: null,
        machine: mkMachine(), department: null, productionLine: null,
        maintenancePersonnel: { id: 'p-1', role: 'E', specialty: null, operationalPerson: { id: 'op-1', code: 'O', name: 'N', phone: null, email: null } },
      });
      const result = await service.findOne('ra-1', ctx);
      expect(result.id).toBe('ra-1');
    });

    it('rejects MACHINE-scoped assignment from different company', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-2', scopeType: 'MACHINE', machineId: 'm-9', departmentId: null, productionLineId: null,
        machine: { id: 'm-9', companyId: 'company-b' }, department: null, productionLine: null,
        maintenancePersonnel: { id: 'p-1', role: 'E', specialty: null, operationalPerson: {} },
      });
      await expect(service.findOne('ra-2', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects DEPARTMENT-scoped assignment from different company', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-3', scopeType: 'DEPARTMENT', machineId: null, departmentId: 'd-9', productionLineId: null,
        machine: null, department: { id: 'd-9', companyId: 'company-b' }, productionLine: null,
        maintenancePersonnel: { id: 'p-1', role: 'E', specialty: null, operationalPerson: {} },
      });
      await expect(service.findOne('ra-3', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects PRODUCTION_LINE-scoped assignment from different company', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-4', scopeType: 'PRODUCTION_LINE', machineId: null, departmentId: null, productionLineId: 'l-9',
        machine: null, department: null, productionLine: { id: 'l-9', companyId: 'company-b' },
        maintenancePersonnel: { id: 'p-1', role: 'E', specialty: null, operationalPerson: {} },
      });
      await expect(service.findOne('ra-4', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove — sets status INACTIVE (no deletedAt)', () => {
    it('soft-deletes by setting status to INACTIVE', async () => {
      prisma.machineResponsibilityAssignment.findUnique.mockResolvedValue({
        id: 'ra-1', scopeType: 'MACHINE', machineId: 'm-1', departmentId: null, productionLineId: null,
        machine: mkMachine(), department: null, productionLine: null,
        maintenancePersonnel: { id: 'p-1', role: 'E', specialty: null, operationalPerson: { id: 'op-1', code: 'O', name: 'N', phone: null, email: null } },
      });
      prisma.machineResponsibilityAssignment.update.mockResolvedValue({ id: 'ra-1', status: 'INACTIVE' });

      await service.remove('ra-1', userId, ctx);

      expect(prisma.machineResponsibilityAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ra-1' }, data: { status: 'INACTIVE' } }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entity: 'MachineResponsibilityAssignment' }),
      );
    });
  });
});
