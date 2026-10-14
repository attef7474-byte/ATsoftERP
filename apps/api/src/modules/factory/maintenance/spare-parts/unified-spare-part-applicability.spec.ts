import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';

/**
 * UNIFIED SPARE PART CATALOG — focused API tests A1..A15.
 *
 * These exercise the single atomic batch operation that replaced per-machine
 * applicability management: `setMachineLinks`. Every machine id is validated
 * against the caller's operational context, duplicates collapse, existing rows
 * are reactivated rather than duplicated, removals deactivate rather than delete,
 * and no legacy `MachinePart` row is ever created.
 */
describe('SparePartsService.setMachineLinks (A1..A15)', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
  const machineScope = { companyId: 'company-a', deletedAt: null, OR: [{ branchId: 'branch-a' }, { branchId: null }] };

  interface BuildOptions {
    sparePart?: any;
    missingSparePart?: boolean;
    machines?: Array<{ id: string }>;
    existing?: Array<{ id: string; machineId: string; status: string }>;
    finalLinks?: Array<{ id: string; machineId: string; machine: any }>;
    unit?: { code: string } | null;
  }

  const buildService = (opts: BuildOptions = {}) => {
    const sparePart = opts.sparePart ?? { id: 'spare-1', code: 'SP-1', unit: 'pcs', unitId: null };
    const machineFindMany = jest.fn().mockResolvedValue(opts.machines ?? []);
    const machineSparePartFindMany = jest.fn().mockImplementation((args: any) =>
      Promise.resolve(args?.where?.status === 'ACTIVE' ? (opts.finalLinks ?? []) : (opts.existing ?? [])),
    );
    const create = jest.fn().mockImplementation((a: any) => Promise.resolve({ id: 'created', ...a.data }));
    const update = jest.fn().mockImplementation((a: any) => Promise.resolve({ id: a.where.id, ...a.data }));
    const remove = jest.fn().mockResolvedValue({});
    const machinePartCreate = jest.fn().mockResolvedValue({});
    const logWithClient = jest.fn();

    const tx: any = {
      sparePart: { findFirst: jest.fn().mockResolvedValue(opts.missingSparePart ? null : sparePart) },
      machine: { findMany: machineFindMany },
      machineSparePart: { findMany: machineSparePartFindMany, create, update, delete: remove },
      machinePart: { create: machinePartCreate },
      unit: { findUnique: jest.fn().mockResolvedValue(opts.unit ?? null) },
    };
    const db: any = {
      ...tx,
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    const audit: any = { logWithClient };
    const service = new SparePartsService(db, audit, {} as any);
    return { service, tx, db, machineFindMany, machineSparePartFindMany, create, update, remove, machinePartCreate, logWithClient };
  };

  it('A1: no machines clears the active applicability set without creating rows', async () => {
    const { service, create, update, logWithClient, machineFindMany } = buildService({
      existing: [
        { id: 'l1', machineId: 'm1', status: 'ACTIVE' },
        { id: 'l2', machineId: 'm2', status: 'ACTIVE' },
      ],
      finalLinks: [],
    });
    const res = await service.setMachineLinks('spare-1', [], 'user-a', ctx);
    expect(machineFindMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls.map((c) => c[0].data.status)).toEqual(['INACTIVE', 'INACTIVE']);
    expect(res).toMatchObject({ added: 0, reactivated: 0, deactivated: 2, linkedMachines: 0 });
    expect(logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SET_MACHINE_APPLICABILITY' }));
  });

  it('A2: links a single machine', async () => {
    const { service, create, machineFindMany } = buildService({
      machines: [{ id: 'm1' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: { id: 'm1', name: 'M1', code: 'M-1' } }],
    });
    const res = await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: { machineId: 'm1', sparePartId: 'spare-1', quantity: 1, unit: 'pcs' } });
    expect(res).toMatchObject({ added: 1, reactivated: 0, deactivated: 0, linkedMachines: 1 });
    expect(machineFindMany.mock.calls[0][0].where).toMatchObject({ id: { in: ['m1'] }, ...machineScope });
  });

  it('A3: links multiple machines in one call', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      existing: [],
      finalLinks: [
        { id: 'l1', machineId: 'm1', machine: {} },
        { id: 'l2', machineId: 'm2', machine: {} },
        { id: 'l3', machineId: 'm3', machine: {} },
      ],
    });
    const res = await service.setMachineLinks('spare-1', ['m1', 'm2', 'm3'], 'user-a', ctx);
    expect(create).toHaveBeenCalledTimes(3);
    expect(res).toMatchObject({ added: 3, linkedMachines: 3 });
  });

  it('A4: one spare part can be linked to many machines', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }],
      existing: [],
      finalLinks: [1, 2, 3, 4].map((n) => ({ id: `l${n}`, machineId: `m${n}`, machine: {} })),
    });
    const res = await service.setMachineLinks('spare-1', ['m1', 'm2', 'm3', 'm4'], 'user-a', ctx);
    expect(create).toHaveBeenCalledTimes(4);
    expect(res.linkedMachines).toBe(4);
  });

  it('A5: a duplicate machineId never produces a duplicate relation', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
    });
    const res = await service.setMachineLinks('spare-1', ['m1', 'm1', 'm1'], 'user-a', ctx);
    expect(create).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ added: 1, linkedMachines: 1 });
  });

  it('A6: an existing inactive relation is reactivated, not duplicated', async () => {
    const { service, create, update } = buildService({
      machines: [{ id: 'm1' }],
      existing: [{ id: 'l1', machineId: 'm1', status: 'INACTIVE' }],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
    });
    const res = await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: 'l1' }, data: { status: 'ACTIVE' } });
    expect(res).toMatchObject({ added: 0, reactivated: 1, deactivated: 0, linkedMachines: 1 });
  });

  it('A7: an invalid machine id rejects the whole transaction with zero side effects', async () => {
    const { service, create, update, machinePartCreate, logWithClient } = buildService({
      machines: [{ id: 'm1' }],
      existing: [],
    });
    await expect(service.setMachineLinks('spare-1', ['m1', 'm-missing'], 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(machinePartCreate).not.toHaveBeenCalled();
    expect(logWithClient).not.toHaveBeenCalled();
  });

  it('A8: a machine outside the active context is rejected', async () => {
    const { service, create, machineFindMany } = buildService({ machines: [], existing: [] });
    await expect(service.setMachineLinks('spare-1', ['machine-b'], 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(machineFindMany.mock.calls[0][0].where).toMatchObject(machineScope);
    expect(create).not.toHaveBeenCalled();
  });

  it('A9: a later edit adds the additionally selected machine', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }],
      existing: [{ id: 'l1', machineId: 'm1', status: 'ACTIVE' }],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }, { id: 'l2', machineId: 'm2', machine: {} }],
    });
    const res = await service.setMachineLinks('spare-1', ['m1', 'm2'], 'user-a', ctx);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: { machineId: 'm2', sparePartId: 'spare-1', quantity: 1, unit: 'pcs' } });
    expect(res).toMatchObject({ added: 1, reactivated: 0, deactivated: 0, linkedMachines: 2 });
  });

  it('A10: a later edit removes a machine by deactivation, never deletion', async () => {
    const { service, update, remove } = buildService({
      machines: [{ id: 'm1' }],
      existing: [
        { id: 'l1', machineId: 'm1', status: 'ACTIVE' },
        { id: 'l2', machineId: 'm2', status: 'ACTIVE' },
      ],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
    });
    const res = await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    expect(remove).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: 'l2' }, data: { status: 'INACTIVE' } });
    expect(res).toMatchObject({ added: 0, reactivated: 0, deactivated: 1, linkedMachines: 1 });
  });

  it('A11: editing preserves untouched active links', async () => {
    const { service, create, update } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }],
      existing: [{ id: 'l1', machineId: 'm1', status: 'ACTIVE' }],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }, { id: 'l2', machineId: 'm2', machine: {} }],
    });
    await service.setMachineLinks('spare-1', ['m1', 'm2'], 'user-a', ctx);
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: { machineId: 'm2', sparePartId: 'spare-1', quantity: 1, unit: 'pcs' } });
  });

  it('A12: applicability rows never carry a per-machine product authority', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
    });
    await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    expect(create.mock.calls[0][0].data).not.toHaveProperty('productId');
  });

  it('A13: no legacy MachinePart row is created or touched', async () => {
    const { service, machinePartCreate } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }, { id: 'l2', machineId: 'm2', machine: {} }],
    });
    await service.setMachineLinks('spare-1', ['m1', 'm2'], 'user-a', ctx);
    expect(machinePartCreate).not.toHaveBeenCalled();
  });

  it('A14: applicability linkage is by machineId, never by name', async () => {
    const { service, create } = buildService({
      machines: [{ id: 'm1' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
    });
    await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    const data = create.mock.calls[0][0].data;
    expect(data.machineId).toBe('m1');
    expect(data).not.toHaveProperty('name');
    expect(data).not.toHaveProperty('machineName');
  });

  it('A15: the reported linked-machine count equals the active scoped set', async () => {
    const { service } = buildService({
      machines: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      existing: [],
      finalLinks: [
        { id: 'l1', machineId: 'm1', machine: {} },
        { id: 'l2', machineId: 'm2', machine: {} },
        { id: 'l3', machineId: 'm3', machine: {} },
      ],
    });
    const res = await service.setMachineLinks('spare-1', ['m1', 'm2', 'm3'], 'user-a', ctx);
    expect(res.linkedMachines).toBe(3);
    expect(res.machines).toHaveLength(3);
  });

  it('A15b: the unit is inherited from the canonical unit master when present', async () => {
    const { service, create } = buildService({
      sparePart: { id: 'spare-1', code: 'SP-1', unit: 'legacy', unitId: 'unit-kg' },
      machines: [{ id: 'm1' }],
      existing: [],
      finalLinks: [{ id: 'l1', machineId: 'm1', machine: {} }],
      unit: { code: 'KG' },
    });
    await service.setMachineLinks('spare-1', ['m1'], 'user-a', ctx);
    expect(create).toHaveBeenCalledWith({ data: { machineId: 'm1', sparePartId: 'spare-1', quantity: 1, unit: 'KG' } });
  });

  it('A0: a missing spare part is rejected before any machine work', async () => {
    const { service, machinePartCreate, logWithClient } = buildService({ missingSparePart: true });
    await expect(service.setMachineLinks('nope', ['m1'], 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(machinePartCreate).not.toHaveBeenCalled();
    expect(logWithClient).not.toHaveBeenCalled();
  });
});
