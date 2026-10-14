import { BadRequestException } from '@nestjs/common';
import { MachineComponentsService } from './machine-components.service';

/**
 * Focused tests for multi-machine component creation (one independent
 * MachineComponent row per selected machine, atomic batch).
 *
 * Matrices: A1–A7 basic, D dedupe/concurrency, V validation, C code integrity,
 * S serial safety, P parent ownership, T tenant isolation, plus response shape and audit.
 */
describe('MachineComponentsService — multi-machine batch create', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
  const userId = 'user-1';

  let seq = 0;
  const mkMachine = (id: string, code: string, over: any = {}) => ({
    id, code, name: `Machine ${code}`, companyId: 'company-a', branchId: 'branch-a', status: 'ACTIVE', deletedAt: null, ...over,
  });

  const buildTx = () => ({
    machine: { findMany: jest.fn().mockResolvedValue([]) },
    machineComponent: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: any) => ({ id: `comp-${++seq}`, ...args.data })),
    },
  });

  const buildService = (tx: any) => {
    const prisma: any = { ...tx, $transaction: (fn: any) => fn(tx) };
    const audit: any = { log: jest.fn(), logWithClient: jest.fn().mockResolvedValue(undefined) };
    return { service: new MachineComponentsService(prisma, audit), audit, prisma };
  };

  const base = (over: any = {}) => ({
    machineIds: ['m-1', 'm-2', 'm-3'],
    code: 'CMP-1',
    name: 'Bearing',
    componentType: 'MECHANICAL',
    ...over,
  });

  const codeOf = async (thunk: () => Promise<any>): Promise<string | undefined> => {
    try {
      await thunk();
      return undefined;
    } catch (err: any) {
      const body = typeof err?.getResponse === 'function' ? err.getResponse() : undefined;
      return body?.errors?.[0]?.code;
    }
  };

  // A1/A2 — one independent row per machine.
  it('A1 creates exactly one independent row per selected machine (distinct ids, own machineId, shared code)', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2'), mkMachine('m-3', 'M3')]);
    const { service } = buildService(tx);

    const res = await service.createBatch(base() as any, userId, ctx);

    expect(tx.machineComponent.create).toHaveBeenCalledTimes(3);
    const rows = tx.machineComponent.create.mock.calls.map((c: any) => c[0].data);
    expect(new Set(rows.map((r: any) => r.machineId))).toEqual(new Set(['m-1', 'm-2', 'm-3']));
    expect(rows.every((r: any) => r.code === 'CMP-1')).toBe(true);
    expect(res.createdCount).toBe(3);
    expect(new Set(res.createdComponents.map((c) => c.id)).size).toBe(3);
    expect(res.createdComponents[0]).toMatchObject({ code: 'CMP-1', name: 'Bearing', machineId: 'm-1', machineCode: 'M1' });
  });

  it('A6 dedupes repeated machine ids before creating', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    const { service } = buildService(tx);

    const res = await service.createBatch(base({ machineIds: ['m-1', 'm-1', 'm-2', 'm-2'] }) as any, userId, ctx);

    expect(tx.machine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['m-1', 'm-2'] } } }));
    expect(tx.machineComponent.create).toHaveBeenCalledTimes(2);
    expect(res.createdCount).toBe(2);
  });

  it('A7 supports a single selected machine (backward compatibility)', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]);
    const { service } = buildService(tx);

    const res = await service.createBatch(base({ machineIds: ['m-1'] }) as any, userId, ctx);

    expect(tx.machineComponent.create).toHaveBeenCalledTimes(1);
    expect(res.createdCount).toBe(1);
  });

  // V — validation.
  it('V1 rejects an empty selection without any write', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: [] }) as any, userId, ctx))).toBe('validation.required');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('V2 rejects a selection of only blanks', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['', ''] }) as any, userId, ctx))).toBe('validation.required');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  // T — tenant isolation.
  it('T1 rejects a foreign/unknown machine atomically', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]); // m-2 missing
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx))).toBe('validation.invalidReference');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('T2 rejects a soft-deleted machine atomically', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2', { deletedAt: new Date() })]);
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx))).toBe('validation.invalidReference');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('T3 rejects an inactive machine atomically', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-2', 'M2', { status: 'INACTIVE' })]);
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-2'] }) as any, userId, ctx))).toBe('maintenance.machineInactive');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  // C — code integrity.
  it('C1 rejects a batch when the code already exists on any selected machine', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    tx.machineComponent.findFirst.mockResolvedValue({ machineId: 'm-2' });
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx))).toBe('validation.duplicateValue');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('C2 maps a database unique violation (P2002) to a duplicate error', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    tx.machineComponent.create
      .mockImplementationOnce((args: any) => ({ id: 'comp-x', ...args.data }))
      .mockImplementationOnce(() => { throw Object.assign(new Error('unique'), { code: 'P2002' }); });
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx))).toBe('validation.duplicateValue');
  });

  // S — serial safety.
  it('S1 rejects a shared serial number across multiple machines', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'], serialNumber: 'SN-1' }) as any, userId, ctx)))
      .toBe('maintenance.batchSerialPerMachineRequired');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('S2 keeps a serial number for a single machine', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]);
    const { service } = buildService(tx);
    await service.createBatch(base({ machineIds: ['m-1'], serialNumber: 'SN-1' }) as any, userId, ctx);
    expect(tx.machineComponent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ serialNumber: 'SN-1' }) }));
  });

  it('S3 never copies a serial number to multiple rows (stored null when multi without serial)', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    const { service } = buildService(tx);
    await service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx);
    const rows = tx.machineComponent.create.mock.calls.map((c: any) => c[0].data);
    expect(rows.every((r: any) => r.serialNumber === null)).toBe(true);
  });

  // P — parent ownership.
  it('P1 rejects a shared parent component across multiple machines', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1', 'm-2'], parentComponentId: 'p-1' }) as any, userId, ctx)))
      .toBe('maintenance.batchParentPerMachineRequired');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('P2 accepts a parent that belongs to the same (single) machine', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]);
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'p-1', machineId: 'm-1', machine: { companyId: 'company-a', branchId: 'branch-a' } });
    const { service } = buildService(tx);
    await service.createBatch(base({ machineIds: ['m-1'], parentComponentId: 'p-1' }) as any, userId, ctx);
    expect(tx.machineComponent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ parentComponentId: 'p-1' }) }));
  });

  it('P3 rejects a parent that belongs to a different machine', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]);
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'p-1', machineId: 'm-other', machine: { companyId: 'company-a', branchId: 'branch-a' } });
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1'], parentComponentId: 'p-1' }) as any, userId, ctx)))
      .toBe('validation.invalidValue');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('P4 rejects a foreign-tenant parent component', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1')]);
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'p-1', machineId: 'm-1', machine: { companyId: 'other-co', branchId: 'branch-a' } });
    const { service } = buildService(tx);
    expect(await codeOf(() => service.createBatch(base({ machineIds: ['m-1'], parentComponentId: 'p-1' }) as any, userId, ctx)))
      .toBe('validation.invalidReference');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  // Audit.
  it('writes one audit event per created component with batch correlation', async () => {
    const tx = buildTx();
    tx.machine.findMany.mockResolvedValue([mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2')]);
    const { service, audit } = buildService(tx);

    await service.createBatch(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx);

    expect(audit.logWithClient).toHaveBeenCalledTimes(2);
    const first = audit.logWithClient.mock.calls[0];
    expect(first[1]).toMatchObject({ userId, action: 'CREATE', entity: 'MachineComponent' });
    const details = JSON.parse(first[1].details);
    expect(details).toMatchObject({ companyId: 'company-a', branchId: 'branch-a', batch: true, batchSize: 2 });
    expect(typeof details.batchCorrelationId).toBe('string');
  });
});
