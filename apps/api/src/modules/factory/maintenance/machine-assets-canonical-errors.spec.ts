import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { MachinePartsService } from './machine-parts/machine-parts.service';
import { MachineCategoriesService } from './machine-categories/machine-categories.service';
import { MachineComponentsService } from './machine-components/machine-components.service';
import { MachineDocumentsService } from './machine-documents/machine-documents.service';
import { MaintenanceService } from './maintenance.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1',
  scopeId: 'b1',
  companyId: 'c1',
  companyName: 'Company One',
  companyCode: 'C1',
  branchId: 'b1',
  branchName: 'Branch One',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};
const ownedMachine = { id: 'm1', code: 'M-001', name: 'Lathe', companyId: 'c1', branchId: 'b1' };

const expectValidationError = async (promise: Promise<unknown>, field: string, code: string) => {
  await expect(promise).rejects.toThrow(BadRequestException);
  const error: any = await promise.catch((e) => e);
  const response = error.getResponse();
  expect(response.messageKey).toBe('common.validationFailed');
  expect(response.errors[0]).toMatchObject({ field, code });
};

const expectMessageKeyNotFound = async (promise: Promise<unknown>, messageKey: string) => {
  await expect(promise).rejects.toThrow(NotFoundException);
  const error: any = await promise.catch((e) => e);
  const response = error.getResponse();
  expect(response.messageKey).toBe(messageKey);
};

describe('Machine assets canonical error contracts', () => {
  describe('MachinePartsService', () => {
    let prisma: any;
    let audit: any;
    let numbering: any;
    let service: MachinePartsService;

    beforeEach(() => {
      prisma = {
        machinePart: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        machine: { findUnique: jest.fn() },
        product: { findUnique: jest.fn() },
        maintenanceRequestPartUsage: { count: jest.fn() },
      };
      audit = { log: jest.fn().mockResolvedValue(undefined) };
      numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PART-0001') };
      service = new MachinePartsService(prisma as PrismaService, audit as AuditService, numbering as NumberingService);
    });

    it('generates an auto code from numbering when code is absent', async () => {
      prisma.machinePart.findUnique.mockResolvedValue(null);
      prisma.machinePart.create.mockResolvedValue({ id: 'p1', code: 'PART-0001', name: 'Pump' });

      const result = await service.create({ name: 'Pump', quantity: 1, unit: 'pc' }, 'u1', ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('MACHINE_PART');
      expect(prisma.machinePart.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: 'PART-0001' }) }));
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MachinePart', 'p1', expect.anything());
      expect(result.code).toBe('PART-0001');
    });

    it('rejects a duplicate code with a canonical field error', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'p9', code: 'PART-001' });
      await expectValidationError(service.create({ code: 'PART-001', name: 'Pump', quantity: 1, unit: 'pc' }, 'u1', ctx), 'code', 'validation.duplicateValue');
    });

    it('rejects an unknown machineId with a canonical field error', async () => {
      prisma.machinePart.findUnique.mockResolvedValue(null);
      prisma.machine.findUnique.mockResolvedValue(null);
      await expectValidationError(service.create({ name: 'Pump', machineId: 'ghost', quantity: 1, unit: 'pc' }, 'u1', ctx), 'machineId', 'validation.invalidReference');
    });

    it('rejects a machineId from another company with a canonical field error', async () => {
      prisma.machinePart.findUnique.mockResolvedValue(null);
      prisma.machine.findUnique.mockResolvedValue({ ...ownedMachine, id: 'mX', companyId: 'c2' });
      await expectValidationError(service.create({ name: 'Pump', machineId: 'mX', quantity: 1, unit: 'pc' }, 'u1', ctx), 'machineId', 'validation.invalidReference');
    });

    it('rejects an unknown productId with a canonical field error', async () => {
      prisma.machinePart.findUnique.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue(null);
      await expectValidationError(service.create({ name: 'Pump', productId: 'ghost', quantity: 1, unit: 'pc' }, 'u1', ctx), 'productId', 'validation.invalidReference');
    });

    it('throws a messageKey not-found when the part does not exist', async () => {
      prisma.machinePart.findUnique.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.findOne('ghost', ctx), 'maintenance.machinePartNotFound');
    });

    it('throws a messageKey not-found when the part belongs to another company', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'pX', machineId: 'mX', machine: { id: 'mX', companyId: 'c2', branchId: 'b1' } });
      await expectMessageKeyNotFound(service.findOne('pX', ctx), 'maintenance.machinePartNotFound');
    });

    it('rejects changing the code after creation', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'p1', code: 'PART-001' });
      await expectValidationError(service.update('p1', { code: 'PART-002' }, 'u1', ctx), 'code', 'validation.invalidValue');
    });

    it('throws a messageKey not-found when linking to an unknown machine', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'p1', code: 'PART-001', name: 'Pump' });
      prisma.machine.findUnique.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.linkToMachine('p1', 'ghost', 'u1', ctx), 'maintenance.machineNotFound');
    });

    it('deletes the part and audits DELETE with the userId', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'p1', code: 'PART-001', name: 'Pump', productId: null });
      prisma.maintenanceRequestPartUsage.count.mockResolvedValue(0);
      prisma.machinePart.delete.mockResolvedValue({ id: 'p1' });

      const result = await service.remove('p1', 'u1', ctx);
      expect(prisma.machinePart.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MachinePart', 'p1', expect.anything());
      expect(result.message).toBe('Machine part deleted successfully');
    });

    it('blocks deleting a part with linked usage records', async () => {
      prisma.machinePart.findUnique.mockResolvedValue({ id: 'p1', code: 'PART-001', name: 'Pump', productId: 'prod1' });
      prisma.maintenanceRequestPartUsage.count.mockResolvedValue(3);

      await expect(service.remove('p1', 'u1', ctx)).rejects.toThrow(ConflictException);
      expect(prisma.machinePart.delete).not.toHaveBeenCalled();
    });
  });

  describe('MachineCategoriesService', () => {
    let prisma: any;
    let audit: any;
    let numbering: any;
    let service: MachineCategoriesService;

    beforeEach(() => {
      prisma = {
        machineCategory: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
        machine: { count: jest.fn() },
      };
      audit = { log: jest.fn().mockResolvedValue(undefined) };
      numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('CAT-0001') };
      service = new MachineCategoriesService(prisma as PrismaService, audit as AuditService, numbering as NumberingService);
    });

    it('generates an auto code from numbering when code is absent', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue(null);
      prisma.machineCategory.create.mockResolvedValue({ id: 'c1', code: 'CAT-0001', name: 'Machining' });

      const result = await service.create({ name: 'Machining' }, 'u1');
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('MACHINE_CATEGORY');
      expect(prisma.machineCategory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: 'CAT-0001' }) }));
      expect(result.code).toBe('CAT-0001');
    });

    it('rejects a duplicate code with a canonical field error', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c9', code: 'CAT-001' });
      await expectValidationError(service.create({ code: 'CAT-001', name: 'Machining' }, 'u1'), 'code', 'validation.duplicateValue');
    });

    it('rejects an unknown parent with a canonical field error', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue(null);
      await expectValidationError(service.create({ name: 'Machining', parentId: 'ghost' }, 'u1'), 'parentId', 'validation.invalidReference');
    });

    it('throws a messageKey not-found when the category does not exist', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.findOne('ghost'), 'maintenance.machineCategoryNotFound');
    });

    it('rejects changing the code after creation', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001' });
      await expectValidationError(service.update('c1', { code: 'CAT-002' }, 'u1'), 'code', 'validation.invalidValue');
    });

    it('rejects a category being its own parent', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001' });
      await expectValidationError(service.update('c1', { parentId: 'c1' }, 'u1'), 'parentId', 'validation.invalidValue');
    });

    it('audits activate and deactivate with the userId', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001', status: 'ACTIVE' });
      prisma.machineCategory.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
      await service.activate('c1', 'u1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'ACTIVATE', 'MachineCategory', 'c1');

      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001', status: 'INACTIVE' });
      prisma.machineCategory.update.mockResolvedValue({ id: 'c1', status: 'INACTIVE' });
      await service.deactivate('c1', 'u1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'DEACTIVATE', 'MachineCategory', 'c1');
    });

    it('soft-deletes the category and audits DELETE with the userId', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001', name: 'Machining' });
      prisma.machine.count.mockResolvedValue(0);
      prisma.machineCategory.count.mockResolvedValue(0);
      prisma.machineCategory.update.mockResolvedValue({ id: 'c1', deletedAt: new Date() });

      const result = await service.remove('c1', 'u1');
      expect(prisma.machineCategory.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MachineCategory', 'c1', expect.anything());
      expect(result.message).toBe('Machine category deleted successfully');
    });

    it('blocks deleting a category with linked machines', async () => {
      prisma.machineCategory.findUnique.mockResolvedValue({ id: 'c1', code: 'CAT-001', name: 'Machining' });
      prisma.machine.count.mockResolvedValue(2);

      await expect(service.remove('c1', 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.machineCategory.update).not.toHaveBeenCalled();
    });
  });

  describe('MachineComponentsService', () => {
    let prisma: any;
    let audit: any;
    let service: MachineComponentsService;

    beforeEach(() => {
      prisma = {
        machine: { findUnique: jest.fn() },
        machineComponent: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        componentSparePart: { count: jest.fn() },
      };
      audit = { log: jest.fn().mockResolvedValue(undefined) };
      service = new MachineComponentsService(prisma as PrismaService, audit as AuditService);
    });

    it('rejects an unknown machine with a canonical field error', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      await expectValidationError(service.create({ name: 'Gearbox', componentType: 'MECHANICAL', machineId: 'ghost' } as any, 'u1', ctx), 'machineId', 'validation.invalidReference');
    });

    it('rejects a machine from another company with a canonical field error', async () => {
      prisma.machine.findUnique.mockResolvedValue({ ...ownedMachine, id: 'mX', companyId: 'c2' });
      await expectValidationError(service.create({ name: 'Gearbox', componentType: 'MECHANICAL', machineId: 'mX' } as any, 'u1', ctx), 'machineId', 'validation.invalidReference');
    });

    it('rejects a duplicate component code within the machine', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.machineComponent.findUnique.mockResolvedValue({ id: 'x1', code: 'GB-1' });
      await expectValidationError(service.create({ code: 'GB-1', name: 'Gearbox', componentType: 'MECHANICAL', machineId: 'm1' } as any, 'u1', ctx), 'code', 'validation.duplicateValue');
    });

    it('throws a messageKey not-found when the component does not exist', async () => {
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.findOne('ghost', ctx), 'maintenance.componentNotFound');
    });

    it('throws a messageKey not-found when the component belongs to another company', async () => {
      prisma.machineComponent.findUnique.mockResolvedValue({ id: 'xX', code: 'GB-2', machineId: 'mX', machine: { id: 'mX', companyId: 'c2', branchId: 'b1' } });
      await expectMessageKeyNotFound(service.findOne('xX', ctx), 'maintenance.componentNotFound');
    });

    it('rejects changing the code after creation', async () => {
      prisma.machineComponent.findUnique.mockResolvedValue({ id: 'x1', code: 'GB-1', machineId: 'm1', machine: ownedMachine });
      await expectValidationError(service.update('x1', { code: 'GB-2' } as any, 'u1', ctx), 'code', 'validation.invalidValue');
    });

    it('soft-deletes the component and audits DELETE with the userId', async () => {
      prisma.machineComponent.findUnique.mockResolvedValue({ id: 'x1', code: 'GB-1', machineId: 'm1', machine: ownedMachine });
      prisma.machineComponent.count.mockResolvedValue(0);
      prisma.componentSparePart.count.mockResolvedValue(0);
      prisma.machineComponent.update.mockResolvedValue({ id: 'x1', deletedAt: new Date() });

      const result = await service.remove('x1', 'u1', ctx);
      expect(prisma.machineComponent.update).toHaveBeenCalledWith({ where: { id: 'x1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MachineComponent', 'x1', expect.anything());
      expect(result.message).toBe('Machine component deleted successfully');
    });

    it('blocks deleting a component with child components', async () => {
      prisma.machineComponent.findUnique.mockResolvedValue({ id: 'x1', code: 'GB-1', machineId: 'm1', machine: ownedMachine });
      prisma.machineComponent.count.mockResolvedValue(1);

      await expect(service.remove('x1', 'u1', ctx)).rejects.toThrow(ConflictException);
      expect(prisma.machineComponent.update).not.toHaveBeenCalled();
    });
  });

  describe('MachineDocumentsService', () => {
    let prisma: any;
    let audit: any;
    let service: MachineDocumentsService;

    beforeEach(() => {
      prisma = {
        $transaction: jest.fn(async (cb: any) => cb(prisma)),
        machine: { findFirst: jest.fn() },
        machineDocument: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          findMany: jest.fn(),
        },
      };
      audit = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
      service = new MachineDocumentsService(prisma as PrismaService, audit as AuditService);
    });

    it('rejects an unknown machine with a canonical field error', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);
      await expectValidationError(service.create({ machineId: 'ghost', title: 'Manual', type: 'PDF', fileUrl: 'http://x' } as any, 'u1', ctx), 'machineId', 'validation.invalidReference');
    });

    it('throws a messageKey not-found when the document does not exist', async () => {
      prisma.machineDocument.findFirst.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.findOne('ghost', ctx), 'maintenance.machineDocumentNotFound');
    });

    it('throws a messageKey not-found when the machine does not exist in getDocumentsByMachine', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.getDocumentsByMachine('ghost', ctx), 'maintenance.machineNotFound');
    });

    it('deletes the document and audits DELETE with the userId', async () => {
      prisma.machineDocument.findFirst.mockResolvedValue({ id: 'd1', title: 'Manual', machineId: 'm1' });
      prisma.machineDocument.delete.mockResolvedValue({ id: 'd1' });

      const result = await service.remove('d1', 'u1', ctx);
      expect(prisma.machineDocument.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ userId: 'u1', action: 'DELETE', entity: 'MachineDocument', entityId: 'd1' }));
      expect(result.message).toBe('Machine document deleted successfully');
    });
  });

  describe('MaintenanceService (machines)', () => {
    let prisma: any;
    let numbering: any;
    let audit: any;
    let service: MaintenanceService;

    beforeEach(() => {
      prisma = {
        machine: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        machineComponent: { count: jest.fn() },
        maintenanceRequest: { count: jest.fn() },
        maintenanceSchedule: { count: jest.fn() },
        downtimeLog: { count: jest.fn() },
        machinePart: { count: jest.fn() },
        machineDocument: { count: jest.fn() },
      };
      numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('M-0001') };
      audit = { log: jest.fn().mockResolvedValue(undefined) };
      service = new MaintenanceService(prisma as PrismaService, numbering as NumberingService, audit as AuditService);
    });

    it('creates a machine with an auto code and audits CREATE with the userId', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machine.create.mockResolvedValue(ownedMachine);

      const result = await service.createMachine({ name: 'Lathe' } as any, 'u1', ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('MACHINE');
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'Machine', 'm1', expect.anything());
      expect(result.code).toBe('M-001');
    });

    it('rejects a duplicate machine code with a canonical field error', async () => {
      prisma.machine.findUnique.mockResolvedValue({ id: 'm9', code: 'M-001' });
      await expectValidationError(service.createMachine({ code: 'M-001', name: 'Lathe' } as any, 'u1', ctx), 'code', 'validation.duplicateValue');
    });

    it('throws a messageKey not-found when the machine does not exist', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      await expectMessageKeyNotFound(service.findOneMachine('ghost', ctx), 'maintenance.machineNotFound');
    });

    it('throws a messageKey not-found when the machine belongs to another company', async () => {
      prisma.machine.findUnique.mockResolvedValue({ ...ownedMachine, id: 'mX', companyId: 'c2' });
      await expectMessageKeyNotFound(service.findOneMachine('mX', ctx), 'maintenance.machineNotFound');
    });

    it('rejects changing the machine code after creation', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      await expectValidationError(service.updateMachine('m1', { code: 'M-002' } as any, 'u1', ctx), 'code', 'validation.invalidValue');
    });

    it('audits activate, deactivate and status changes with the userId', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.machine.update.mockResolvedValue({ id: 'm1', code: 'M-001', status: 'ACTIVE' });
      await service.activateMachine('m1', 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'ACTIVATE', 'Machine', 'm1', expect.anything());

      prisma.machine.update.mockResolvedValue({ id: 'm1', code: 'M-001', status: 'INACTIVE' });
      await service.deactivateMachine('m1', 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'DEACTIVATE', 'Machine', 'm1', expect.anything());

      prisma.machine.update.mockResolvedValue({ id: 'm1', code: 'M-001', status: 'MAINTENANCE' });
      await service.updateMachineStatus('m1', 'MAINTENANCE', 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'Machine', 'm1', expect.anything());
    });

    it('soft-deletes the machine and audits DELETE with the userId', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.machineComponent.count.mockResolvedValue(0);
      prisma.maintenanceRequest.count.mockResolvedValue(0);
      prisma.maintenanceSchedule.count.mockResolvedValue(0);
      prisma.downtimeLog.count.mockResolvedValue(0);
      prisma.machine.update.mockResolvedValue({ id: 'm1', deletedAt: new Date() });

      const result = await service.removeMachine('m1', 'u1', ctx);
      expect(prisma.machine.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'Machine', 'm1', expect.anything());
      expect(result.message).toBe('Machine deleted successfully');
    });

    it('blocks deleting a machine with linked components', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.machineComponent.count.mockResolvedValue(1);

      await expect(service.removeMachine('m1', 'u1', ctx)).rejects.toThrow(ConflictException);
      expect(prisma.machine.update).not.toHaveBeenCalled();
    });
  });
});
