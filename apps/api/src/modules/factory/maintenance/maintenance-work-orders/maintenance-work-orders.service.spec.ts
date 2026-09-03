import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MaintenanceWorkOrdersService } from './maintenance-work-orders.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { Prisma } from '@prisma/client';

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

const user: CurrentUserType = { id: 'u1', sub: 'u1', email: 'u@a.com', name: 'U' };

const wo = (overrides: Record<string, any> = {}) => ({
  id: 'wo1',
  companyId: 'c1',
  branchId: 'b1',
  workOrderNumber: 'WO-0001',
  title: 'Fix motor',
  description: null,
  type: 'CORRECTIVE',
  priority: 'MEDIUM',
  status: 'DRAFT',
  machineId: null,
  machineComponentId: null,
  requestId: null,
  warehouseId: null,
  assignedToId: null,
  supervisorId: null,
  createdById: 'u1',
  plannedStartAt: null,
  plannedEndAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  estimatedCost: null,
  actualCost: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const part = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  workOrderId: 'wo1',
  sparePartId: 'sp1',
  productId: 'prd1',
  quantity: 2,
  unit: 'pcs',
  unitCost: 10,
  totalCost: 20,
  notes: null,
  issuedQuantity: 0,
  stockIssueStatus: 'PENDING',
  lastIssueAt: null,
  lastIssueById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MaintenanceWorkOrdersService', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let productionCost: any;
  let costCenterResolver: any;
  let service: MaintenanceWorkOrdersService;

  beforeEach(() => {
    prisma = {
      maintenanceWorkOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      maintenanceWorkOrderPart: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      maintenanceWorkOrderCostEntry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      operationalCostTransaction: { findFirst: jest.fn() },
      costCenter: { findFirst: jest.fn() },
      machine: { findUnique: jest.fn(), findFirst: jest.fn() },
      machineComponent: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wo1' }]),
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('WO-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
    productionCost = {
      postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({ transaction: { id: 'ledger1' }, replay: false }),
      reverseLedgerEntry: jest.fn(),
    };
    costCenterResolver = { resolveWithClient: jest.fn() };
    service = new MaintenanceWorkOrdersService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
      { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null) } as any,
      productionCost,
      costCenterResolver,
    );
  });

  describe('create', () => {
    it('rejects a machine from another company', async () => {
      prisma.machine.findUnique.mockResolvedValue({ id: 'mX', companyId: 'c2', branchId: 'b1' });

      const promise = service.create({ title: 'WO', machineId: 'mX' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'machineId', code: 'validation.invalidReference' });
    });

    it('rejects a request whose machine belongs to another company', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'rX', machineId: 'mX' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'mX', companyId: 'c2', branchId: 'b1' });

      const promise = service.create({ title: 'WO', requestId: 'rX' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'requestId', code: 'validation.invalidReference' });
    });

    it('creates a work order with a generated number in the active context and audits it', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.maintenanceWorkOrder.create.mockResolvedValue(wo({ workOrderNumber: 'WO-0001' }));

      const result = await service.create({ title: 'Fix motor' }, user, ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('MAINTENANCE_WORK_ORDER');
      expect(prisma.maintenanceWorkOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            workOrderNumber: 'WO-0001',
            title: 'Fix motor',
            status: 'DRAFT',
            createdById: 'u1',
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceWorkOrder', 'wo1', expect.any(Object));
      expect(result.workOrderNumber).toBe('WO-0001');
    });

    it('creates nested part lines and derives product from the spare part', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.sparePart.findUnique.mockResolvedValue({ id: 'sp1', productId: 'prd1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Bearing' });
      prisma.maintenanceWorkOrder.create.mockResolvedValue(wo());

      await service.create({
        title: 'Fix motor',
        parts: [{ sparePartId: 'sp1', quantity: 2, unitCost: 10 }],
      }, user, ctx);

      const createCall = prisma.maintenanceWorkOrder.create.mock.calls[0][0];
      expect(createCall.data.parts.create[0]).toMatchObject({
        sparePartId: 'sp1',
        productId: 'prd1',
        quantity: 2,
        unitCost: 10,
        totalCost: 20,
      });
    });

    it('throws when a part line has neither sparePartId nor productId', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const promise = service.create({ title: 'WO', parts: [{ quantity: 1 } as any] }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'sparePartId', code: 'validation.required' });
    });
  });

  describe('findOne (tenant isolation)', () => {
    it('returns the work order when it belongs to the active context', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      const result = await service.findOne('wo1', ctx);
      expect(result.id).toBe('wo1');
    });

    it('throws NotFound when the work order belongs to another company', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ companyId: 'c2' }));
      await expect(service.findOne('wo1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the work order belongs to another branch', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ branchId: 'b2' }));
      await expect(service.findOne('wo1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when missing', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(null);
      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('maintenance.workOrderNotFound');
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the active company and branch', async () => {
      prisma.maintenanceWorkOrder.findMany.mockResolvedValue([]);
      prisma.maintenanceWorkOrder.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);
      expect(prisma.maintenanceWorkOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(prisma.maintenanceWorkOrder.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
      );
    });

    it('applies status and search filters', async () => {
      prisma.maintenanceWorkOrder.findMany.mockResolvedValue([]);
      prisma.maintenanceWorkOrder.count.mockResolvedValue(0);

      await service.findAll({ status: 'PLANNED', search: 'motor' }, ctx);
      expect(prisma.maintenanceWorkOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PLANNED', OR: expect.any(Array) }) }),
      );
    });
  });

  describe('update', () => {
    it('rejects an update when the work order belongs to another company', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ companyId: 'c2' }));
      await expect(service.update('wo1', { title: 'X' }, user, ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a warehouse from another company', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wX', companyId: 'c2', branchId: 'b1' });

      const promise = service.update('wo1', { warehouseId: 'wX' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
    });

    it('updates an owned work order and audits it', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.machineComponent.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ title: 'Renamed', priority: 'HIGH' }));

      const result = await service.update('wo1', { title: 'Renamed', priority: 'HIGH' }, user, ctx);
      expect(prisma.maintenanceWorkOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wo1' }, data: expect.objectContaining({ title: 'Renamed' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'MaintenanceWorkOrder', 'wo1', expect.any(Object));
      expect(result.title).toBe('Renamed');
    });
  });

  describe('transition (status workflow)', () => {
    it('plans a DRAFT work order', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ status: 'PLANNED' }));

      const result = await service.transition('wo1', { action: 'plan' }, user, ctx);
      expect(prisma.maintenanceWorkOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PLANNED' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'STATUS_TRANSITION', 'MaintenanceWorkOrder', 'wo1',
        expect.objectContaining({ from: 'DRAFT', to: 'PLANNED' }));
      expect(result.status).toBe('PLANNED');
    });

    it('rejects planning a work order that is already PLANNED', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'PLANNED' }));
      const promise = service.transition('wo1', { action: 'plan' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('starts a PLANNED work order and records startedAt', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'PLANNED' }));
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ status: 'IN_PROGRESS', startedAt: new Date() }));

      const result = await service.transition('wo1', { action: 'start' }, user, ctx);
      const updateCall = prisma.maintenanceWorkOrder.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('IN_PROGRESS');
      expect(updateCall.data.startedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('rejects starting a DRAFT work order', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      await expect(service.transition('wo1', { action: 'start' }, user, ctx)).rejects.toThrow(BadRequestException);
    });

    it('blocks completion while a part line is partially issued', async () => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(wo({ status: 'IN_PROGRESS', costEntries: [] }));
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([part({ stockIssueStatus: 'PARTIALLY_ISSUED' })]);

      const promise = service.transition('wo1', { action: 'complete' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('completes a work order and computes actualCost from issued parts and cost entries', async () => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(wo({ status: 'IN_PROGRESS', costEntries: [] }));
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([
        part({ stockIssueStatus: 'FULLY_ISSUED' }),
        part({ stockIssueStatus: 'PENDING', id: 'p2' }),
      ]);
      prisma.maintenanceWorkOrderPart.aggregate.mockResolvedValue({ _sum: { totalCost: 20 } });
      prisma.maintenanceWorkOrderCostEntry.findMany.mockResolvedValue([]);
      prisma.maintenanceWorkOrderCostEntry.aggregate.mockResolvedValue({ _sum: { amount: 30.5 } });
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ status: 'COMPLETED', actualCost: 50.5 }));

      const result = await service.transition('wo1', { action: 'complete' }, user, ctx);
      const updateCall = prisma.maintenanceWorkOrder.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.actualCost).toBe(50.5);
      expect(result.status).toBe('COMPLETED');
    });

    it('requires a reason to cancel', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      const promise = service.transition('wo1', { action: 'cancel' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'reason', code: 'validation.required' });
    });

    it('cancels a PLANNED work order with a reason and records cancelledAt', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'PLANNED' }));
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'parts unavailable' }));

      const result = await service.transition('wo1', { action: 'cancel', reason: 'parts unavailable' }, user, ctx);
      const updateCall = prisma.maintenanceWorkOrder.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('CANCELLED');
      expect(updateCall.data.cancelReason).toBe('parts unavailable');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('COST-R2B manual asserted maintenance labor', () => {
    const incurredAt = new Date('2026-09-03T09:00:00.000Z');
    const labor = { id: 'labor1', amount: new Prisma.Decimal('125.75'), incurredAt };
    const completingWorkOrder = (overrides: Record<string, any> = {}) => wo({
      status: 'IN_PROGRESS',
      machineId: 'm1',
      requestId: 'mr1',
      request: { id: 'mr1', machineId: 'm1', productionLineId: 'line1', costCenterId: 'cc1' },
      machine: { id: 'm1', productionLineId: 'line1', departmentId: 'dep1', defaultCostCenterId: 'cc-machine' },
      costEntries: [labor],
      ...overrides,
    });

    beforeEach(() => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(completingWorkOrder());
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([]);
      prisma.maintenanceWorkOrderCostEntry.findMany.mockResolvedValue([labor]);
      prisma.maintenanceWorkOrderPart.aggregate.mockResolvedValue({ _sum: { totalCost: null } });
      prisma.maintenanceWorkOrderCostEntry.aggregate.mockResolvedValue({ _sum: { amount: labor.amount } });
      prisma.machine.findFirst.mockResolvedValue({
        id: 'm1', productionLineId: 'line1', departmentId: 'dep1', defaultCostCenterId: 'cc-machine',
      });
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', departmentId: 'dep1' });
      prisma.maintenanceWorkOrder.update.mockResolvedValue(completingWorkOrder({ status: 'COMPLETED', actualCost: labor.amount }));
    });

    it('posts one eligible LABOR source while completing the work order', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(1);
    });

    it('uses the source entry id for sourceId, sourceLineId and fingerprint', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      const opts = productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1];
      expect(opts).toMatchObject({
        sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY',
        sourceId: 'labor1',
        sourceLineId: 'labor1',
        sourceFingerprint: 'MAINTENANCE_WORK_ORDER_COST_ENTRY:labor1:LABOR',
      });
    });

    it('copies the authoritative labor amount exactly without recomputing it', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1].amount).toBe(labor.amount);
    });

    it('uses LABOR, MAINTENANCE and MANUAL_ASSERTED_ACTUAL semantics', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1]).toMatchObject({
        eventType: 'LABOR', costPurpose: 'MAINTENANCE', costNature: 'MANUAL_ASSERTED_ACTUAL', entryRole: 'PRIMARY_COST',
      });
    });

    it('does not invent hours, quantity or a labor rate', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      const opts = productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1];
      expect(opts.quantity.toString()).toBe('0');
      expect(opts.rate.toString()).toBe('0');
      expect(opts.unit).toBe('AMOUNT');
    });

    it('preserves tenant and maintenance attribution without production order/run attribution', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      const opts = productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1];
      expect(opts.ctx).toBe(ctx);
      expect(opts.refs).toMatchObject({
        maintenanceWorkOrderId: 'wo1', maintenanceRequestId: 'mr1', machineId: 'm1',
        productionLineId: 'line1', costCenterId: 'cc1', departmentId: 'dep1',
      });
      expect(opts.refs.productionOrderId).toBeUndefined();
      expect(opts.refs.productionRunId).toBeUndefined();
    });

    it('lets the canonical writer obtain currency only from Company.operationalCurrencyCode', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1].currencyCode).toBeNull();
    });

    it('uses the maintenance request cost center before the machine default', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(prisma.costCenter.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cc1' }) }));
      expect(costCenterResolver.resolveWithClient).not.toHaveBeenCalled();
    });

    it('uses the configured machine default when no request cost center exists', async () => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(completingWorkOrder({
        request: { id: 'mr1', machineId: 'm1', productionLineId: 'line1', costCenterId: null },
      }));
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc-machine', departmentId: 'dep1' });
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(prisma.costCenter.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cc-machine' }) }));
    });

    it('falls back to the existing operational cost-center resolver when no configured center exists', async () => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(completingWorkOrder({
        request: { id: 'mr1', machineId: 'm1', productionLineId: 'line1', costCenterId: null },
      }));
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', productionLineId: 'line1', departmentId: 'dep1', defaultCostCenterId: null });
      costCenterResolver.resolveWithClient.mockResolvedValue({ costCenterId: 'cc-resolved' });
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc-resolved', departmentId: 'dep1' });
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(costCenterResolver.resolveWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ resourceType: 'MACHINE', machineId: 'm1' }),
        ctx,
      );
    });

    it('blocks completion when the required cost center is not valid in the tenant', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null);
      await expect(service.transition('wo1', { action: 'complete' }, user, ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.maintenanceWorkOrder.update).not.toHaveBeenCalled();
    });

    it('blocks cross-tenant machine attribution', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);
      await expect(service.transition('wo1', { action: 'complete' }, user, ctx)).rejects.toThrow(BadRequestException);
      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    });

    it('does not post non-LABOR entries or secondary actualCost summaries', async () => {
      prisma.maintenanceWorkOrderCostEntry.findMany.mockResolvedValue([]);
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(prisma.maintenanceWorkOrderCostEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ type: 'LABOR', amount: { gt: 0 } }),
      }));
      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    });

    it('posts every distinct eligible labor source exactly once', async () => {
      prisma.maintenanceWorkOrderCostEntry.findMany.mockResolvedValue([
        labor,
        { id: 'labor2', amount: new Prisma.Decimal('20'), incurredAt },
      ]);
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(2);
      expect(productionCost.postLedgerEntryWithinTransaction.mock.calls.map((c: any[]) => c[1].sourceId)).toEqual(['labor1', 'labor2']);
    });

    it('repeated completion is idempotent and never backfills an already-completed historical work order', async () => {
      prisma.maintenanceWorkOrder.findFirst.mockResolvedValue(completingWorkOrder({ status: 'COMPLETED' }));
      const result = await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(result.status).toBe('COMPLETED');
      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
      expect(prisma.maintenanceWorkOrder.update).not.toHaveBeenCalled();
    });

    it('maps a database uniqueness race to a non-500 domain conflict', async () => {
      productionCost.postLedgerEntryWithinTransaction.mockRejectedValue({ code: 'P2002' });
      await expect(service.transition('wo1', { action: 'complete' }, user, ctx)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rolls source completion back when canonical posting fails', async () => {
      productionCost.postLedgerEntryWithinTransaction.mockRejectedValue(new BadRequestException('ledger blocked'));
      await expect(service.transition('wo1', { action: 'complete' }, user, ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.maintenanceWorkOrder.update).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('writes the completion audit inside the same transaction', async () => {
      await service.transition('wo1', { action: 'complete' }, user, ctx);
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({
        action: 'STATUS_TRANSITION', entity: 'MaintenanceWorkOrder', entityId: 'wo1',
      }));
      expect(audit.log).not.toHaveBeenCalledWith(expect.anything(), 'STATUS_TRANSITION', expect.anything(), expect.anything(), expect.anything());
    });

    it('freezes cost-entry updates after work-order completion', async () => {
      prisma.maintenanceWorkOrderCostEntry.findUnique.mockResolvedValue({ id: 'labor1', workOrderId: 'wo1', amount: labor.amount });
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(completingWorkOrder({ status: 'COMPLETED' }));
      await expect(service.updateCostEntry('labor1', { amount: 500 }, user, ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.maintenanceWorkOrderCostEntry.update).not.toHaveBeenCalled();
    });

    it('freezes a posted source even if an inconsistent work-order status is encountered', async () => {
      prisma.maintenanceWorkOrderCostEntry.findUnique.mockResolvedValue({ id: 'labor1', workOrderId: 'wo1', amount: labor.amount });
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(completingWorkOrder({ status: 'IN_PROGRESS' }));
      prisma.operationalCostTransaction.findFirst.mockResolvedValue({ id: 'ledger1' });
      await expect(service.updateCostEntry('labor1', { amount: 500 }, user, ctx)).rejects.toThrow(BadRequestException);
    });

    it('freezes cost-entry deletion after cancellation as well as completion', async () => {
      prisma.maintenanceWorkOrderCostEntry.findUnique.mockResolvedValue({ id: 'labor1', workOrderId: 'wo1', amount: labor.amount });
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(completingWorkOrder({ status: 'CANCELLED' }));
      await expect(service.removeCostEntry('labor1', user, ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.maintenanceWorkOrderCostEntry.delete).not.toHaveBeenCalled();
    });
  });

  describe('parts', () => {
    it('rejects adding a part when the work order is not DRAFT/PLANNED', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'IN_PROGRESS' }));
      const promise = service.addPart('wo1', { sparePartId: 'sp1', quantity: 1 }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('adds a part line to a DRAFT work order and audits it', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.sparePart.findUnique.mockResolvedValue({ id: 'sp1', productId: 'prd1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.maintenanceWorkOrderPart.create.mockResolvedValue(part());

      const result = await service.addPart('wo1', { sparePartId: 'sp1', quantity: 2, unitCost: 10 }, user, ctx);
      expect(prisma.maintenanceWorkOrderPart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workOrderId: 'wo1', sparePartId: 'sp1', productId: 'prd1', quantity: 2 }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceWorkOrderPart', 'p1', expect.any(Object));
      expect(result.id).toBe('p1');
    });

    it('rejects editing a part line that has already been issued', async () => {
      prisma.maintenanceWorkOrderPart.findUnique.mockResolvedValue(part({ issuedQuantity: 2 }));
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());

      const promise = service.updatePart('p1', { quantity: 5 }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('removes a part line and audits it', async () => {
      prisma.maintenanceWorkOrderPart.findUnique.mockResolvedValue(part());
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.maintenanceWorkOrderPart.delete.mockResolvedValue(part());

      const result = await service.removePart('p1', user, ctx);
      expect(prisma.maintenanceWorkOrderPart.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MaintenanceWorkOrderPart', 'p1', expect.any(Object));
      expect(result.message).toContain('deleted');
    });
  });

  describe('issueParts (atomic inventory)', () => {
    const tx = () => ({
      inventoryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      product: { findUnique: jest.fn() },
      maintenanceWorkOrderPart: { update: jest.fn() },
    });

    it('rejects issuing when no warehouse is set on the work order or payload', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'PLANNED' }));
      const promise = service.issueParts('wo1', {}, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.required' });
    });

    it('rejects issuing from a forbidden warehouse type', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', warehouseType: 'PRODUCT' });

      const promise = service.issueParts('wo1', {}, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId' });
    });

    it('rejects a warehouse from another company', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c2', branchId: 'b1', warehouseType: 'SPARE_PART' });

      const promise = service.issueParts('wo1', {}, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
    });

    it('rejects when there are no pending part lines', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', warehouseType: 'SPARE_PART' });
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([part({ issuedQuantity: 2, stockIssueStatus: 'FULLY_ISSUED' })]);

      const promise = service.issueParts('wo1', {}, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.required' });
    });

    it('throws an insufficient stock error and does not post the movement', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', warehouseType: 'SPARE_PART' });
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([part()]);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const t = tx();
        t.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 1 });
        return cb(t);
      });

      const promise = service.issueParts('wo1', {}, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.insufficientStock' });
    });

    it('decrements the balance, posts a movement and marks the line FULLY_ISSUED atomically', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', warehouseType: 'SPARE_PART' });
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([part()]);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const t = tx();
        t.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10 });
        t.inventoryBalance.update.mockResolvedValue({ id: 'bal1', quantity: 8 });
        t.inventoryMovement.create.mockResolvedValue({ id: 'mv1', lines: [] });
        t.maintenanceWorkOrderPart.update.mockResolvedValue(part({ issuedQuantity: 2, stockIssueStatus: 'FULLY_ISSUED' }));
        return cb(t);
      });

      const result = await service.issueParts('wo1', {}, user, ctx);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', expect.anything());
      expect(audit.log).toHaveBeenCalledWith('u1', 'ISSUE_STOCK', 'MaintenanceWorkOrder', 'wo1', expect.any(Object));
      expect(result.id).toBe('wo1');
    });

    it('rejects a partLineId that does not belong to the work order', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ warehouseId: 'w1', status: 'PLANNED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', warehouseType: 'SPARE_PART' });
      prisma.maintenanceWorkOrderPart.findMany.mockResolvedValue([part()]);

      const promise = service.issueParts('wo1', { partLineIds: ['foreign'] }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'partLineIds', code: 'validation.invalidReference' });
    });
  });

  describe('cost entries', () => {
    it('adds a cost entry and audits it', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'IN_PROGRESS' }));
      prisma.maintenanceWorkOrderCostEntry.create.mockResolvedValue({ id: 'ce1', workOrderId: 'wo1', type: 'LABOR', amount: 120.5 });

      const result = await service.addCostEntry('wo1', { type: 'LABOR', amount: 120.5 }, user, ctx);
      expect(prisma.maintenanceWorkOrderCostEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ workOrderId: 'wo1', type: 'LABOR', amount: 120.5 }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceWorkOrderCostEntry', 'ce1', expect.any(Object));
      expect(result.amount).toBe(120.5);
    });

    it('rejects adding a cost entry to a completed work order', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'COMPLETED' }));
      const promise = service.addCostEntry('wo1', { type: 'LABOR', amount: 10 }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('rejects removing a cost entry from a completed work order', async () => {
      prisma.maintenanceWorkOrderCostEntry.findUnique.mockResolvedValue({ id: 'ce1', workOrderId: 'wo1', amount: 10 });
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'COMPLETED' }));

      const promise = service.removeCostEntry('ce1', user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('removes a cost entry from a non-completed work order and audits it', async () => {
      prisma.maintenanceWorkOrderCostEntry.findUnique.mockResolvedValue({ id: 'ce1', workOrderId: 'wo1', amount: 10 });
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'IN_PROGRESS' }));
      prisma.maintenanceWorkOrderCostEntry.delete.mockResolvedValue({ id: 'ce1' });

      const result = await service.removeCostEntry('ce1', user, ctx);
      expect(prisma.maintenanceWorkOrderCostEntry.delete).toHaveBeenCalledWith({ where: { id: 'ce1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MaintenanceWorkOrderCostEntry', 'ce1', expect.any(Object));
      expect(result.message).toContain('deleted');
    });
  });

  describe('remove (soft delete)', () => {
    it('rejects deleting a work order in IN_PROGRESS', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ status: 'IN_PROGRESS' }));
      const promise = service.remove('wo1', user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidStatusTransition' });
    });

    it('soft-deletes a DRAFT work order and audits it', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo());
      prisma.maintenanceWorkOrder.update.mockResolvedValue(wo({ deletedAt: new Date() }));

      const result = await service.remove('wo1', user, ctx);
      expect(prisma.maintenanceWorkOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wo1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'MaintenanceWorkOrder', 'wo1', expect.any(Object));
      expect(result.message).toContain('deleted');
    });

    it('rejects deleting a work order from another company', async () => {
      prisma.maintenanceWorkOrder.findUnique.mockResolvedValue(wo({ companyId: 'c2' }));
      await expect(service.remove('wo1', user, ctx)).rejects.toThrow(NotFoundException);
    });
  });
});
