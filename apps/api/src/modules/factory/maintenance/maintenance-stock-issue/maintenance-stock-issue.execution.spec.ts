import { Prisma } from '@prisma/client';
import { AuditService } from '../../../../common/audit/audit.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';
import { ExecutionPartIssueInput, MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { validate } from 'class-validator';
import { ExecutionPartInputDto } from '../maintenance-tasks/dto/execution-action.dto';

const ctx: any = { companyId: 'company', branchId: 'branch' };
const machine = { id: 'machine', companyId: 'company', branchId: 'branch' };
const input = (extra: Partial<ExecutionPartIssueInput> = {}): ExecutionPartIssueInput => ({
  executionId: 'execution', productId: 'product', warehouseId: 'warehouse',
  quantity: 2, usageType: 'CONSUMED', clientRequestId: 'submission', ...extra,
});

function fixture() {
  let sequence = 0;
  let state: any = { quantity: 10, base: '10', movements: [], installed: [], replacements: [],
    requirements: [], conditions: [], audits: [], removedStatus: 'ACTIVE', orderIssued: 0 };
  const product = { id: 'product', status: 'ACTIVE', deletedAt: null, unit: 'pcs' };
  const sparePart = { id: 'spare', code: 'SP', name: 'Spare', productId: 'product', status: 'ACTIVE', deletedAt: null };
  const oldPart = { id: 'old-installed', machineId: 'machine', machineComponentId: null,
    sparePartId: 'old-spare', productId: 'old-product', installedQuantity: 1,
    installedCondition: 'USED_SERVICEABLE', installedAt: new Date('2025-12-01T09:00:00Z'), machine,
    sparePart: { id: 'old-spare', code: 'OLD', name: 'Old spare', productId: 'old-product' } };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    machine: { findUnique: jest.fn().mockResolvedValue(machine) },
    machineComponent: { findUnique: jest.fn().mockResolvedValue({ id: 'component', machineId: 'machine', machine }) },
    product: { findUnique: jest.fn().mockImplementation(async () => product) },
    sparePart: { findUnique: jest.fn().mockImplementation(async () => sparePart) },
    warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse', ...ctx, warehouseType: 'SPARE_PARTS' }), findUnique: jest.fn().mockResolvedValue({ id: 'warehouse', ...ctx, warehouseType: 'SPARE_PARTS' }) },
    warehouseLocation: { findUnique: jest.fn().mockResolvedValue({ id: 'location', warehouseId: 'warehouse' }) },
    inventoryBalance: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'balance', quantity: state.quantity, quantityBase: new Prisma.Decimal(state.base) })),
      update: jest.fn().mockImplementation(async ({ data }: any) => { state.quantity = data.quantity; state.base = data.quantityBase.toString(); }),
    },
    inventoryMovement: { create: jest.fn().mockImplementation(async ({ data }: any) => {
      if (state.movements.some((m: any) => m.requestId === data.requestId)) throw new Error('unique submission');
      const row = { ...data, id: `movement-${++sequence}`, lines: [{ ...data.lines.create[0], id: `line-${sequence}` }] };
      state.movements.push(row); return row;
    }) },
    sparePartConditionBalance: {
      findFirst: jest.fn().mockResolvedValue({ id: 'condition-balance', quantity: 10, availableQuantity: 10 }),
      update: jest.fn().mockResolvedValue({}),
    },
    sparePartConditionMovement: { create: jest.fn().mockImplementation(async ({ data }: any) => {
      const row = { ...data, id: `condition-${++sequence}` }; state.conditions.push(row); return row;
    }) },
    maintenanceRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'request', machineId: 'machine', status: 'IN_PROGRESS' }) },
    maintenanceRequestRequiredPart: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const row = { ...data, id: 'required', issuedQuantity: 0, returnedQuantity: 0 };
        state.requirements.push(row); return row;
      }),
      findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}),
    },
    maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', status: 'IN_PROGRESS' }) },
    maintenanceWorkOrderPart: {
      findFirst: jest.fn().mockResolvedValue({ id: 'planned', sparePartId: null, productId: 'product', quantity: 1, issuedQuantity: 0 }),
      update: jest.fn().mockImplementation(async ({ data }: any) => { state.orderIssued = data.issuedQuantity; }),
    },
    machineInstalledPart: {
      findFirst: jest.fn().mockResolvedValue({ id: 'old-installed' }),
      findUnique: jest.fn().mockImplementation(async () => ({ ...oldPart, status: state.removedStatus })),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const row = { ...data, id: 'installed' }; state.installed.push(row); return row;
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => { state.removedStatus = data.status; return { ...oldPart, ...data }; }),
    },
    sparePartReplacementHistory: { create: jest.fn().mockImplementation(async ({ data }: any) => {
      const row = { ...data, id: 'replacement' }; state.replacements.push(row); return row;
    }) },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }: any) => { state.audits.push(data); return data; }) },
  };
  const prisma: any = { $transaction: jest.fn().mockImplementation(async (fn: any) => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try { return await fn(tx); } catch (error) { state = snapshot; throw error; }
  }) };
  const numbering: any = { generateNumberAtomicWithClient: jest.fn().mockImplementation(async (key: string) => `${key}-${++sequence}`) };
  const audit = new AuditService(prisma);
  const installed = new InstalledPartsReplacementService(prisma, numbering, audit);
  const valuation: any = { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null),
    aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new Prisma.Decimal(10)),
    applyValuedIssue: jest.fn().mockResolvedValue({ totalCost: new Prisma.Decimal(6), currencyCode: 'USD' }) };
  const cost: any = { postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({}) };
  const service = new MaintenanceStockIssueService(prisma, audit, numbering, {} as any, installed, valuation, cost);
  const run = (part: ExecutionPartIssueInput) => prisma.$transaction((client: any) => service.issueExecutionPartInTx(client, part, 'user', ctx));
  return { tx, prisma, service, valuation, cost, product, sparePart, oldPart, run, state: () => state };
}

describe('Maintenance execution canonical inventory orchestration', () => {
  it('DIRECT GENERAL consumes a product once without creating request, order or installed part', async () => {
    const f = fixture(); const result = await f.run(input());
    expect(result).toMatchObject({ productId: 'product', sparePartId: null, requiredPartId: null,
      workOrderPartId: null, installedPartId: null, replacementHistoryId: null });
    expect(f.state()).toMatchObject({ quantity: 8, base: '8' });
    expect(f.state().movements).toHaveLength(1);
    expect(f.state().installed).toHaveLength(0);
    expect(f.tx.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled();
    expect(f.tx.maintenanceWorkOrderPart.update).not.toHaveBeenCalled();
    expect(f.state().movements[0]).toMatchObject({ sourceType: 'MAINTENANCE_EXECUTION', sourceId: 'execution' });
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('team-level part usage creates one movement with no per-engineer duplication', async () => {
    const f = fixture(); await f.run(input({ executionSessionId: null }));
    expect(f.state().movements).toHaveLength(1);
    expect(f.state().quantity).toBe(8);
  });

  it('CONSUMED canonical spare part records condition OUT without installation', async () => {
    const f = fixture(); await f.run(input({ machineId: 'machine', sparePartId: 'spare' }));
    expect(f.state().conditions).toHaveLength(1);
    expect(f.state().conditions[0]).toMatchObject({ direction: 'OUT', sparePartId: 'spare' });
    expect(f.state().installed).toHaveLength(0);
  });

  it('INSTALLED uses the existing guarded installed-part writer for a real machine', async () => {
    const f = fixture(); const result = await f.run(input({ machineId: 'machine', machineComponentId: 'component',
      sparePartId: 'spare', usageType: 'INSTALLED' }));
    expect(result.installedPartId).toBe('installed');
    expect(f.state().installed[0]).toMatchObject({ machineId: 'machine', machineComponentId: 'component',
      sparePartId: 'spare', maintenanceRequestId: undefined, sourceType: 'MAINTENANCE_EXECUTION' });
    expect(f.tx.machineComponent.findUnique).toHaveBeenCalledTimes(2);
  });

  it('REPLACED resolves actual old identity and reuses canonical removal and history', async () => {
    const f = fixture(); const result = await f.run(input({ machineId: 'machine', sparePartId: 'spare',
      usageType: 'REPLACED', oldInstalledPartId: 'old-installed', replacementAction: 'NO_REMOVED_PART',
      noReturnReason: 'Destroyed during failure' }));
    expect(result.replacementHistoryId).toBe('replacement');
    expect(f.state().removedStatus).toBe('REMOVED');
    expect(f.state().replacements[0]).toMatchObject({ oldInstalledPartId: 'old-installed',
      oldSparePartId: 'old-spare', newSparePartId: 'spare', newInstalledPartId: 'installed',
      removedQuantity: 1, removedReturnedToStock: false });
    expect(f.state().conditions.filter((c: any) => c.direction === 'IN')).toHaveLength(0);
  });

  it('returned replacement condition uses OLD catalog/product identity', async () => {
    const f = fixture(); await f.run(input({ machineId: 'machine', sparePartId: 'spare', usageType: 'REPLACED',
      oldInstalledPartId: 'old-installed', replacementAction: 'RETURNED_REMOVED_PART', removedPartCondition: 'USED_REPAIRABLE',
      removedPartWarehouseId: 'warehouse', removedPartQuantity: 1 }));
    expect(f.state().conditions.find((c: any) => c.direction === 'IN')).toMatchObject({
      sparePartId: 'old-spare', productId: 'old-product', quantity: 1 });
  });

  it.each(['INSTALLED', 'REPLACED'] as const)('%s rejects missing real machine', async (usageType) => {
    const f = fixture(); await expect(f.run(input({ usageType, sparePartId: 'spare' }))).rejects.toMatchObject({
      response: { messageKey: 'maintenance.executionInstallationRequiresMachine' } });
    expect(f.state().movements).toHaveLength(0);
  });

  it('installation rejects product-only consumables', async () => {
    const f = fixture(); await expect(f.run(input({ usageType: 'INSTALLED', machineId: 'machine' }))).rejects.toMatchObject({
      response: { messageKey: 'maintenance.executionInstallationRequiresSparePart' } });
  });

  it('M5 rejects a same-tenant wrong-machine component with canonical 400', async () => {
    const f = fixture(); f.tx.machineComponent.findUnique.mockResolvedValue({ machineId: 'other', machine });
    await expect(f.run(input({ machineId: 'machine', machineComponentId: 'component' }))).rejects.toMatchObject({
      status: 400, response: { messageKey: 'maintenance.machineComponentMachineMismatch' } });
    expect(f.state().movements).toHaveLength(0);
  });

  it('M5 rejects an out-of-context component with 404', async () => {
    const f = fixture(); f.tx.machineComponent.findUnique.mockResolvedValue({ machineId: 'foreign', machine: { companyId: 'other' } });
    await expect(f.run(input({ machineId: 'machine', machineComponentId: 'foreign' }))).rejects.toMatchObject({ status: 404 });
  });

  it('rejects foreign warehouse before inventory posting', async () => {
    const f = fixture(); f.tx.warehouse.findFirst.mockResolvedValue(null);
    await expect(f.run(input())).rejects.toMatchObject({ status: 404,
      response: { messageKey: 'maintenance.executionWarehouseNotFound' } });
    expect(f.state().movements).toHaveLength(0);
    expect(f.tx.warehouse.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'company' }) });
  });

  it.each(['INACTIVE', 'DELETED'])('rejects %s spare part', async (status) => {
    const f = fixture(); if (status === 'DELETED') f.sparePart.deletedAt = new Date() as any; else f.sparePart.status = status;
    await expect(f.run(input({ sparePartId: 'spare' }))).rejects.toMatchObject({ status: 400 });
    expect(f.state().movements).toHaveLength(0);
  });

  it('rejects mismatched Product and SparePart identities', async () => {
    const f = fixture(); await expect(f.run(input({ sparePartId: 'spare', productId: 'other' }))).rejects.toMatchObject({
      response: { messageKey: 'maintenance.executionProductMismatch' } });
  });

  it('request unplanned usage creates approved internal line and preserves canonical issue tracking', async () => {
    const f = fixture(); const result = await f.run(input({ requestId: 'request', machineId: 'machine', sparePartId: 'spare' }));
    expect(result.requiredPartId).toBe('required');
    expect(f.state().requirements[0]).toMatchObject({ maintenanceRequestId: 'request', sparePartId: 'spare',
      quantity: 2, approvedQuantity: 2, status: 'APPROVED', approvedByUserId: 'user' });
    expect(f.tx.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ issuedQuantity: 2, stockIssueStatus: 'FULLY_ISSUED' }) }));
  });

  it('planned quantity remains unchanged when actual work-order consumption exceeds its estimate', async () => {
    const f = fixture(); await f.run(input({ workOrderId: 'order', workOrderPartId: 'planned' }));
    expect(f.state().orderIssued).toBe(2);
    expect(f.tx.maintenanceWorkOrderPart.update.mock.calls[0][0].data.quantity).toBeUndefined();
  });

  it('unplanned work-order stock needs no invented planned line', async () => {
    const f = fixture(); const result = await f.run(input({ workOrderId: 'order' }));
    expect(result.workOrderPartId).toBeNull();
    expect(f.tx.maintenanceWorkOrderPart.update).not.toHaveBeenCalled();
  });

  it('insufficient stock rolls back the newly created internal request line and all effects', async () => {
    const f = fixture(); await expect(f.run(input({ requestId: 'request', machineId: 'machine', sparePartId: 'spare', quantity: 11 })))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.executionInsufficientStock' } });
    expect(f.state()).toMatchObject({ quantity: 10, base: '10', movements: [], requirements: [], installed: [], audits: [] });
  });

  it('active valuation calls existing engine once and cost ledger on the exact same transaction', async () => {
    const f = fixture(); f.valuation.findActivePolicyForWarehouse.mockResolvedValue({ currencyCode: 'USD' });
    await f.run(input({ workOrderId: 'order' }));
    expect(f.valuation.applyValuedIssue).toHaveBeenCalledTimes(1);
    expect(f.valuation.applyValuedIssue.mock.calls[0][0]).toBe(f.tx);
    expect(f.cost.postLedgerEntryWithinTransaction.mock.calls[0][0]).toBe(f.tx);
    expect(f.cost.postLedgerEntryWithinTransaction.mock.calls[0][1]).toMatchObject({
      sourceType: 'INVENTORY_MOVEMENT_LINE', refs: { maintenanceWorkOrderId: 'order', productId: 'product' } });
    expect(f.state().quantity).toBe(8);
  });

  it('ledger failure atomically rolls back movement, stock and internal request line', async () => {
    const f = fixture(); f.valuation.findActivePolicyForWarehouse.mockResolvedValue({ currencyCode: 'USD' });
    f.cost.postLedgerEntryWithinTransaction.mockRejectedValue(new Error('ledger unavailable'));
    await expect(f.run(input({ requestId: 'request', machineId: 'machine', sparePartId: 'spare' })))
      .rejects.toThrow('ledger unavailable');
    expect(f.state()).toMatchObject({ quantity: 10, base: '10', movements: [], requirements: [], installed: [], audits: [] });
  });

  it('existing canonical movement submission uniqueness rejects a repeated direct issue without stock change', async () => {
    const f = fixture(); await f.run(input());
    await expect(f.run(input())).rejects.toThrow('unique submission');
    expect(f.state().quantity).toBe(8); expect(f.state().movements).toHaveLength(1);
  });

  it('historical installation records the actual usage time while audit remains a posting fact', async () => {
    const f = fixture(); const usedAt = new Date('2026-01-01T10:00:00Z');
    await f.run(input({ machineId: 'machine', sparePartId: 'spare', usageType: 'INSTALLED', usedAt }));
    expect(f.state().installed[0].installedAt).toEqual(usedAt);
    expect(f.state().movements[0].movementDate).toEqual(usedAt);
    expect(f.state().audits).toHaveLength(1);
  });

  it('historical replacement records identical actual removal, installation and replacement times', async () => {
    const f = fixture(); const usedAt = new Date('2026-01-01T10:00:00Z');
    await f.run(input({ machineId: 'machine', sparePartId: 'spare', usageType: 'REPLACED', usedAt,
      replacementAction: 'NO_REMOVED_PART', oldInstalledPartId: 'old-installed', noReturnReason: 'Destroyed' }));
    expect(f.state().installed[0].installedAt).toEqual(usedAt);
    expect(f.state().replacements[0].replacedAt).toEqual(usedAt);
    expect(f.tx.machineInstalledPart.update.mock.calls[0][0].data.removedAt).toEqual(usedAt);
  });

  it('replacement before original installation rolls back its newly approved request line and all effects', async () => {
    const f = fixture(); const usedAt = new Date('2025-11-01T10:00:00Z');
    await expect(f.run(input({ requestId: 'request', machineId: 'machine', sparePartId: 'spare', usageType: 'REPLACED', usedAt,
      replacementAction: 'NO_REMOVED_PART', oldInstalledPartId: 'old-installed', noReturnReason: 'Destroyed' })))
      .rejects.toMatchObject({ status: 400, response: { messageKey: 'maintenance.executionInvalidChronology' } });
    expect(f.state()).toMatchObject({ quantity: 10, movements: [], requirements: [], installed: [], replacements: [], audits: [], removedStatus: 'ACTIVE' });
  });

  it('rejects quantity precision beyond four decimals before stock or source mutation', async () => {
    const f = fixture(); await expect(f.run(input({ quantity: 0.00001 })))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.executionPartInvalid' } });
    expect(f.state().movements).toHaveLength(0); expect(f.tx.inventoryBalance.update).not.toHaveBeenCalled();
  });

  it('preserves all four allowed decimal places in the authoritative stock balance', async () => {
    const f = fixture(); await f.run(input({ quantity: 0.0001 }));
    expect(f.state().base).toBe('9.9999');
    expect(f.state().movements[0].lines[0].quantityBase.toString()).toBe('0.0001');
  });

  it('service and DTO reject notes beyond the physical inventory movement width', async () => {
    const f = fixture(); await expect(f.run(input({ notes: 'x'.repeat(1001) })))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.executionPartInvalid' } });
    expect(f.state().movements).toHaveLength(0);
    const dto = Object.assign(new ExecutionPartInputDto(), input({ notes: 'x'.repeat(1001) }));
    expect((await validate(dto)).find(error => error.property === 'notes')?.constraints?.maxLength).toBeDefined();
    dto.notes = 'x'.repeat(1000);
    expect((await validate(dto)).find(error => error.property === 'notes')).toBeUndefined();
  });
});
