import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { MaintenanceChecklistExecutionsService } from './maintenance-checklist-executions.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

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

const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1' };

describe('MaintenanceChecklistExecutionsService', () => {
  let prisma: any;
  let audit: any;
  let service: MaintenanceChecklistExecutionsService;

  const execution = (overrides: any = {}) => ({
    id: 'e1',
    scheduleId: 's1',
    schedule: { id: 's1', title: 'Weekly', type: 'PREVENTIVE', machineId: 'm1' },
    requestId: null,
    request: null,
    status: 'IN_PROGRESS',
    completedById: null,
    completedBy: null,
    items: [
      {
        id: 'i1',
        executionId: 'e1',
        status: 'COMPLETED',
        resultValue: '10',
        itemTitleSnapshot: 'Pressure',
        itemMandatorySnapshot: true,
        resultTypeSnapshot: 'NUMBER',
        minValueSnapshot: 5,
        maxValueSnapshot: 15,
        checklistItem: null,
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn() },
      maintenanceChecklistItem: { findMany: jest.fn() },
      maintenanceChecklistExecution: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      maintenanceChecklistExecutionItem: { findUnique: jest.fn(), update: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new MaintenanceChecklistExecutionsService(prisma as PrismaService, audit as AuditService);
  });

  describe('create', () => {
    it('creates an execution with snapshot items and audits', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({ id: 's1', machineId: 'm1', machine: ownedMachine });
      prisma.maintenanceChecklistItem.findMany.mockResolvedValue([
        { id: 'c1', title: 'Pressure', sortOrder: 1, isMandatory: true, resultType: 'NUMBER', minValue: 5, maxValue: 15 },
        { id: 'c2', title: 'Leak check', sortOrder: 2, isMandatory: false, resultType: 'PASS_FAIL', minValue: null, maxValue: null },
      ]);
      prisma.maintenanceChecklistExecution.create.mockResolvedValue({ id: 'e1' });
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue({ id: 'e1', items: [] });

      await service.create({ scheduleId: 's1' } as any, 'u1', ctx);

      expect(prisma.maintenanceChecklistExecutionItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ checklistItemId: 'c1', resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, itemMandatorySnapshot: true }),
          expect.objectContaining({ checklistItemId: 'c2', resultTypeSnapshot: 'PASS_FAIL' }),
        ]),
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceChecklistExecution', 'e1', expect.anything());
    });

    it('rejects a schedule outside the operational context', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({
        id: 'sX',
        machineId: 'mX',
        machine: { id: 'mX', companyId: 'c2', branchId: 'b1' },
      });
      const promise = service.create({ scheduleId: 'sX' } as any, 'u1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.scheduleNotFound');
    });
  });

  describe('updateItem', () => {
    it('rejects PASS_FAIL statuses outside OK/NOT_OK/NA', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'PASS_FAIL', minValueSnapshot: null, maxValueSnapshot: null, checklistItem: null,
      });

      const promise = service.updateItem('e1', 'i1', { status: 'BOGUS' } as any, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.invalidExecutionStatus');
    });

    it('records PASS_FAIL OK with passed=true', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'PASS_FAIL', minValueSnapshot: null, maxValueSnapshot: null, checklistItem: null,
      });
      prisma.maintenanceChecklistExecutionItem.update.mockResolvedValue({ id: 'i1' });

      await service.updateItem('e1', 'i1', { status: 'OK' } as any, 'u1', ctx);

      expect(prisma.maintenanceChecklistExecutionItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: expect.objectContaining({ passed: true, resultValue: 'OK', status: 'COMPLETED', completedById: 'u1' }),
      });
    });

    it('rejects a non-numeric result for NUMBER items', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, checklistItem: null,
      });

      const promise = service.updateItem('e1', 'i1', { resultValue: 'abc' } as any, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.resultValueRequired');
    });

    it('marks NUMBER items below the minimum as failed', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, checklistItem: null,
      });
      prisma.maintenanceChecklistExecutionItem.update.mockResolvedValue({ id: 'i1' });

      await service.updateItem('e1', 'i1', { resultValue: '2' } as any, 'u1', ctx);
      expect(prisma.maintenanceChecklistExecutionItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: expect.objectContaining({ passed: false, status: 'COMPLETED' }),
      });
    });

    it('marks NUMBER items within range as passed', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, checklistItem: null,
      });
      prisma.maintenanceChecklistExecutionItem.update.mockResolvedValue({ id: 'i1' });

      await service.updateItem('e1', 'i1', { resultValue: '10' } as any, 'u1', ctx);
      expect(prisma.maintenanceChecklistExecutionItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: expect.objectContaining({ passed: true, status: 'COMPLETED' }),
      });
    });

    it('does not complete TEXT items with an empty value', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'i1', executionId: 'e1', resultTypeSnapshot: 'TEXT', minValueSnapshot: null, maxValueSnapshot: null, checklistItem: null,
      });
      prisma.maintenanceChecklistExecutionItem.update.mockResolvedValue({ id: 'i1' });

      await service.updateItem('e1', 'i1', { resultValue: '   ' } as any, 'u1', ctx);
      expect(prisma.maintenanceChecklistExecutionItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: expect.not.objectContaining({ status: 'COMPLETED' }),
      });
    });

    it('rejects updates on a completed execution', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution({ status: 'COMPLETED' }));
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);

      const promise = service.updateItem('e1', 'i1', { status: 'OK' } as any, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.executionNotInProgress');
    });

    it('rejects an item that belongs to another execution', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecutionItem.findUnique.mockResolvedValue({
        id: 'iX', executionId: 'e2', resultTypeSnapshot: 'PASS_FAIL', minValueSnapshot: null, maxValueSnapshot: null, checklistItem: null,
      });

      const promise = service.updateItem('e1', 'iX', { status: 'OK' } as any, 'u1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.executionItemNotFound');
    });
  });

  describe('complete', () => {
    it('requires an IN_PROGRESS execution', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution({ status: 'COMPLETED' }));
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);

      const promise = service.complete('e1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.executionNotInProgress');
    });

    it('blocks completion while mandatory items are pending', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(
        execution({ items: [{ id: 'i2', status: 'PENDING', itemMandatorySnapshot: true, itemTitleSnapshot: 'Lube', checklistItem: null }] }),
      );
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);

      const promise = service.complete('e1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.mandatoryItemsPending');
    });

    it('blocks completion when a completed numeric result is out of range', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(
        execution({ items: [{ id: 'i1', status: 'COMPLETED', resultValue: '100', itemMandatorySnapshot: true, resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, checklistItem: null }] }),
      );
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);

      const promise = service.complete('e1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.resultValueOutOfRange');
    });

    it('completes the execution and audits COMPLETE', async () => {
      prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(execution());
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceChecklistExecution.update.mockResolvedValue({ id: 'e1', status: 'COMPLETED' });

      const result = await service.complete('e1', 'u1', ctx);

      expect(prisma.maintenanceChecklistExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'COMPLETED', completedById: 'u1' }),
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'COMPLETE', 'MaintenanceChecklistExecution', 'e1', expect.anything());
      expect(result.status).toBe('COMPLETED');
    });
  });

  it('does not expose executions of another company', async () => {
    prisma.maintenanceChecklistExecution.findUnique.mockResolvedValue(
      execution({ id: 'eX', schedule: { id: 'sX', machineId: 'mX' } }),
    );
    prisma.machine.findUnique.mockResolvedValue({ id: 'mX', companyId: 'c2', branchId: 'b1' });

    const promise = service.findOne('eX', ctx);
    await expect(promise).rejects.toThrow(NotFoundException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.executionNotFound');
  });
});
