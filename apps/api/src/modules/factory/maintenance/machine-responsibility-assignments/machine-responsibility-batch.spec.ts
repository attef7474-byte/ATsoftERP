import { BadRequestException } from '@nestjs/common';
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service';

/**
 * Focused tests for the multi-scope (multi-line + multi-machine) machine responsibility redesign.
 * Covers acceptance items A1–A20:
 *  A1 create one line; A2 create multiple lines; A3 explicit only; A4 mixed;
 *  A5 redundant explicit machine not persisted; A6 dedupe line ids; A7 dedupe machine ids;
 *  A8 cross-tenant line rejected atomically; A9 cross-tenant machine rejected; A10 inactive/deleted line rejected;
 *  A11 invalid machine rejected atomically; A12 duplicate active responsibility prevented; A13 update add line;
 *  A14 update remove line safely; A15 update add explicit machine; A16 update remove explicit machine;
 *  A17 unrelated (department) scopes preserved; A18 primary semantics preserved; A19 dates preserved/validated;
 *  A20 future machine inheritance works (live query).
 */
describe('MachineResponsibilityAssignmentsService — multi-scope batch (A1–A20)', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
  const userId = 'user-1';

  const mkLine = (id: string, code: string) => ({ id, code, name: `Line ${code}` });
  const mkMachine = (id: string, code: string, lineId: string | null) => ({ id, code, name: `Machine ${code}`, productionLineId: lineId });

  const buildTx = () => ({
    productionLine: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    machine: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    maintenancePersonnel: { findUnique: jest.fn().mockResolvedValue({ id: 'p-1', operationalPersonId: 'op-1' }) },
    operationalPersonAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'opa-1' }) },
    machineResponsibilityAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args: any) => ({ id: `new-${Math.random()}`, ...args.data })),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
    },
  });

  const buildService = (tx: any) => {
    const prisma: any = { ...tx, $transaction: (fn: any) => fn(tx) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    return { service: new MachineResponsibilityAssignmentsService(prisma, audit), audit, prisma };
  };

  const baseCreate = (over: any = {}) => ({
    maintenancePersonnelId: 'p-1',
    responsibilityRole: 'ENGINEER',
    startDate: '2026-01-01',
    ...over,
  });

  const lineRow = (id: string, code: string) => ({
    id: `row-${id}`, scopeType: 'PRODUCTION_LINE', productionLineId: id, machineId: null, departmentId: null,
    productionLine: mkLine(id, code), machine: null, department: null,
    maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'Person', phone: null, email: null } },
  });

  // A1
  it('A1 creates a single full-line scope', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ fullLineIds: ['l-1'] }) as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledTimes(1);
    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scopeType: 'PRODUCTION_LINE', productionLineId: 'l-1', machineId: null }) }),
    );
    expect(res.counts.fullLines).toBe(1);
  });

  // A2
  it('A2 creates multiple full-line scopes in one save', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1'), mkLine('l-2', 'L2')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ fullLineIds: ['l-1', 'l-2'] }) as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledTimes(2);
    expect(res.counts.fullLines).toBe(2);
    expect(res.counts.added).toBe(2);
  });

  // A3
  it('A3 creates explicit-machine-only scope', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValueOnce([mkMachine('m-9', 'M9', null)]);
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ explicitMachineIds: ['m-9'] }) as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scopeType: 'MACHINE', machineId: 'm-9', productionLineId: null }) }),
    );
    expect(res.counts.explicitMachines).toBe(1);
  });

  // A4
  it('A4 creates mixed full-line + explicit machine in one save', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany
      .mockResolvedValueOnce([mkMachine('m-1', 'M1', 'l-1')]) // inherited by L1
      .mockResolvedValueOnce([mkMachine('m-9', 'M9', null)]); // explicit outside
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ fullLineIds: ['l-1'], explicitMachineIds: ['m-1', 'm-9'] }) as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledTimes(2); // L1 + M9
    expect(res.counts.fullLines).toBe(1);
    expect(res.counts.explicitMachines).toBe(1);
    expect(res.counts.inheritedMachines).toBe(1);
    expect(res.counts.effectiveMachines).toBe(2);
  });

  // A5
  it('A5 does not persist an explicit machine that is already covered by a selected line', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany
      .mockResolvedValueOnce([mkMachine('m-1', 'M1', 'l-1')]) // inherited
      .mockResolvedValueOnce([mkMachine('m-9', 'M9', null)]);
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ fullLineIds: ['l-1'], explicitMachineIds: ['m-1', 'm-9'] }) as any, userId, ctx);

    const created = tx.machineResponsibilityAssignment.create.mock.calls.map((c: any) => c[0].data);
    expect(created.some((d: any) => d.machineId === 'm-1')).toBe(false);
    expect(res.redundantExplicitMachines).toEqual([
      expect.objectContaining({ machineId: 'm-1', coveredByLineId: 'l-1', coveredByLineCode: 'L1' }),
    ]);
  });

  // A6
  it('A6 dedupes repeated full-line ids', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(tx);

    await service.createBatch(baseCreate({ fullLineIds: ['l-1', 'l-1', 'l-1'] }) as any, userId, ctx);

    expect(tx.productionLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['l-1'] } }) }),
    );
    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledTimes(1);
  });

  // A7
  it('A7 dedupes repeated explicit machine ids', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValueOnce([mkMachine('m-9', 'M9', null)]);
    const { service } = buildService(tx);

    await service.createBatch(baseCreate({ explicitMachineIds: ['m-9', 'm-9'] }) as any, userId, ctx);

    expect(tx.machine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['m-9'] } }) }),
    );
    expect(tx.machineResponsibilityAssignment.create).toHaveBeenCalledTimes(1);
  });

  // A8
  it('A8 rejects a cross-tenant line atomically (no writes)', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([]); // not found in active context
    const { service } = buildService(tx);

    await expect(service.createBatch(baseCreate({ fullLineIds: ['l-foreign'] }) as any, userId, ctx)).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A9
  it('A9 rejects a cross-tenant explicit machine atomically', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValueOnce([]); // requested machine not returned in context
    const { service } = buildService(tx);

    await expect(service.createBatch(baseCreate({ explicitMachineIds: ['m-foreign'] }) as any, userId, ctx)).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A10
  it('A10 rejects an inactive/deleted line (filtered out of ownership query)', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([]);
    const { service } = buildService(tx);

    await expect(service.createBatch(baseCreate({ fullLineIds: ['l-deleted'] }) as any, userId, ctx)).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A11
  it('A11 rejects an invalid machine atomically', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany
      .mockResolvedValueOnce([]) // inherited none
      .mockResolvedValueOnce([]); // explicit requested but none valid
    const { service } = buildService(tx);

    await expect(service.createBatch(baseCreate({ fullLineIds: ['l-1'], explicitMachineIds: ['m-bad'] }) as any, userId, ctx)).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A12
  it('A12 prevents duplicate active responsibility for the same personnel+role+target', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1')]);
    const { service } = buildService(tx);

    const res = await service.createBatch(baseCreate({ fullLineIds: ['l-1'] }) as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
    expect(res.counts.skippedExisting).toBe(1);
    expect(res.counts.added).toBe(0);
  });

  // A13
  it('A13 update adds a new line while keeping the existing one', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1'), mkLine('l-2', 'L2')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1')]);
    const { service } = buildService(tx);

    await service.updateBatch({ maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', fullLineIds: ['l-1', 'l-2'] } as any, userId, ctx);

    const created = tx.machineResponsibilityAssignment.create.mock.calls.map((c: any) => c[0].data);
    expect(created).toHaveLength(1);
    expect(created[0].productionLineId).toBe('l-2');
  });

  // A14
  it('A14 update safely deactivates a removed line (soft, endDate preserved)', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1'), lineRow('l-2', 'L2')]);
    const { service } = buildService(tx);

    await service.updateBatch({ maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', fullLineIds: ['l-1'] } as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'row-l-2' }, data: expect.objectContaining({ status: 'INACTIVE' }) }),
    );
    // l-1 is preserved (no deactivation)
    const deactivated = tx.machineResponsibilityAssignment.update.mock.calls.some((c: any) => c[0].where.id === 'row-l-1');
    expect(deactivated).toBe(false);
  });

  // A15
  it('A15 update adds an explicit machine', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany
      .mockResolvedValueOnce([]) // inherited
      .mockResolvedValueOnce([mkMachine('m-9', 'M9', null)]);
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1')]);
    const { service } = buildService(tx);

    await service.updateBatch({ maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', fullLineIds: ['l-1'], explicitMachineIds: ['m-9'] } as any, userId, ctx);

    const created = tx.machineResponsibilityAssignment.create.mock.calls.map((c: any) => c[0].data);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ scopeType: 'MACHINE', machineId: 'm-9' });
  });

  // A16
  it('A16 update removes an explicit machine', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const machineRow = { ...lineRow('l-1', 'L1'), id: 'row-m-9', scopeType: 'MACHINE', productionLineId: null, machineId: 'm-9', productionLine: null, machine: { id: 'm-9', code: 'M9', name: 'Machine M9' } };
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1'), machineRow]);
    const { service } = buildService(tx);

    await service.updateBatch({ maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', fullLineIds: ['l-1'] } as any, userId, ctx);

    expect(tx.machineResponsibilityAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'row-m-9' }, data: expect.objectContaining({ status: 'INACTIVE' }) }),
    );
  });

  // A17
  it('A17 preserves unrelated department-scoped responsibilities', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const deptRow = { ...lineRow('l-1', 'L1'), id: 'row-dept', scopeType: 'DEPARTMENT', productionLineId: null, departmentId: 'd-1', productionLine: null };
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1'), deptRow]);
    const { service } = buildService(tx);

    await service.updateBatch({ maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', fullLineIds: ['l-1'] } as any, userId, ctx);

    const touched = tx.machineResponsibilityAssignment.update.mock.calls.some((c: any) => c[0].where.id === 'row-dept');
    expect(touched).toBe(false);
  });

  // A18
  it('A18 preserves primary uniqueness (rejects duplicate active primary for the target)', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    tx.machineResponsibilityAssignment.findFirst.mockResolvedValue({ id: 'existing-primary' });
    const { service } = buildService(tx);

    await expect(
      service.createBatch(baseCreate({ fullLineIds: ['l-1'], isPrimary: true }) as any, userId, ctx),
    ).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A19
  it('A19 rejects endDate before startDate', async () => {
    const tx = buildTx();
    tx.productionLine.findMany.mockResolvedValue([mkLine('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(tx);

    await expect(
      service.createBatch(baseCreate({ fullLineIds: ['l-1'], startDate: '2026-05-01', endDate: '2026-01-01' }) as any, userId, ctx),
    ).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // A20
  it('A20 future machine inheritance works through a live line query', async () => {
    const tx = buildTx();
    // coverage: existing logical assignment = line L1; L1 now contains a machine added after the assignment
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1')]);
    tx.machine.findMany.mockResolvedValueOnce([mkMachine('m-new', 'MNEW', 'l-1')]);
    const { service } = buildService(tx);

    const coverage = await service.getCoverage('p-1', 'ENGINEER', ctx);

    expect(coverage.counts.fullLines).toBe(1);
    expect(coverage.inheritedMachines).toEqual([
      expect.objectContaining({ id: 'm-new', code: 'MNEW', productionLineId: 'l-1' }),
    ]);
    expect(coverage.effectiveMachines.some((m: any) => m.id === 'm-new' && m.source === 'INHERITED')).toBe(true);
  });

  // extra: empty selection rejected
  it('rejects a save with no lines and no machines', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(service.createBatch(baseCreate() as any, userId, ctx)).rejects.toThrow(BadRequestException);
    expect(tx.machineResponsibilityAssignment.create).not.toHaveBeenCalled();
  });

  // extra: findGrouped projection
  it('findGrouped groups rows into one logical assignment per personnel+role', async () => {
    const tx = buildTx();
    tx.machineResponsibilityAssignment.findMany.mockResolvedValue([lineRow('l-1', 'L1'), lineRow('l-2', 'L2')]);
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1', 'l-1')]);
    const { service } = buildService(tx);

    const res = await service.findGrouped({ page: 1, limit: 10 }, ctx);

    expect(res.data).toHaveLength(1);
    expect(res.data[0].counts.fullLines).toBe(2);
    expect(res.data[0].counts.inheritedMachines).toBe(1);
    expect(res.data[0].counts.effectiveMachines).toBe(1);
  });
});
