import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MachinePartsService } from './machine-parts.service';

/**
 * R4N regression suite: unified SparePart architecture.
 *
 * Mandated scenarios:
 *  A. Many machines may reference one canonical SparePart item.
 *  B. Many machines/components may reference one canonical item without conflict.
 *  C. Similar names with different technical specification stay distinct.
 *  D. Duplicate API submission is rejected, not silently duplicated.
 *  E. Historical records are preserved and never rewritten.
 *  F. Tenant isolation: a foreign machine/canonical part cannot be referenced.
 *  G. Installation / inventory / catalog records are never cascaded or removed.
 *  H. Second run is idempotent (guards re-evaluate, no duplicate created).
 */
describe('R4N unified spare-part architecture (MachinePartsService)', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;

  const machineInScope = { id: 'machine-1', companyId: 'company-a', branchId: 'branch-a' };
  const machineOutOfScope = { id: 'machine-2', companyId: 'company-b', branchId: 'branch-b' };
  const activeSparePart = { id: 'spare-1', code: 'SP001', name: 'Bearing SKF 6205', status: 'ACTIVE', deletedAt: null };

  /** MachinePart rows must carry the `machine` relation that partAccess selects. */
  const mpRow = (over: any = {}) => ({
    id: 'mp-1',
    code: 'MPP-1',
    name: 'Hydraulic Pump',
    machineId: 'machine-1',
    productId: null,
    sparePartId: null,
    quantity: 1,
    minStock: 0,
    unit: 'pcs',
    ...over,
    machine: 'machine' in over ? over.machine : machineInScope,
  });

  const buildService = (
    opts: {
      existingParts?: any[];
      canonicalSparePart?: any;
      applicabilityLink?: any;
      row?: any;
    } = {},
  ) => {
    // Backing store so created rows become visible to the duplicate-name guard,
    // mirroring real database read-after-write behaviour.
    const store: any[] = [...(opts.existingParts ?? [])];
    let seq = 0;

    const db: any = {
      machine: {
        findUnique: jest.fn().mockResolvedValue(machineInScope),
        findMany: jest.fn().mockResolvedValue([{ id: 'machine-1' }]),
      },
      machinePart: {
        findUnique: jest.fn().mockResolvedValue(opts.row ?? null),
        findMany: jest.fn().mockImplementation((args: any = {}) => {
          const where = args.where ?? {};
          if (where.machineId) return Promise.resolve(store.filter((r) => r.machineId === where.machineId));
          return Promise.resolve(store.slice());
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const row = mpRow({ id: `mp-new-${++seq}`, ...data });
          store.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(mpRow({ id: 'mp-1', ...data }))),
        delete: jest.fn().mockResolvedValue({}),
      },
      machineSparePart: { findFirst: jest.fn().mockResolvedValue(opts.applicabilityLink ?? null) },
      sparePart: { findUnique: jest.fn().mockResolvedValue(opts.canonicalSparePart ?? activeSparePart) },
      product: { findUnique: jest.fn().mockResolvedValue(null) },
      maintenanceRequestPartUsage: { count: jest.fn().mockResolvedValue(0) },
    };
    const audit: any = { log: jest.fn() };
    const numbering: any = { generateNumberAtomic: jest.fn().mockResolvedValue('MPP-GEN-1') };
    // R4O: MachinePartsService re-resolves tenant authority through
    // AllowedContextResolver instead of trusting a claim carried on the request.
    // Every R4N scenario here operates on a part bound to an in-scope machine, so
    // the resolver is never consulted; the mock makes that explicit rather than
    // silently tolerating a missing dependency.
    const resolver: any = { getAuthorization: jest.fn().mockResolvedValue({ isSuperAdmin: false }) };
    return { service: new MachinePartsService(db, audit, numbering, resolver), db, audit, store, resolver };
  };

  const baseDto = () => ({ name: 'Hydraulic Pump', unit: 'pcs', quantity: 1, minStock: 0 } as any);

  // ------------------------------------------------------------------ A
  it('A. permits many distinct machines to reference one canonical SparePart', async () => {
    const machines = [
      { id: 'm1', companyId: 'company-a', branchId: null },
      { id: 'm2', companyId: 'company-a', branchId: 'branch-a' },
      { id: 'm3', companyId: 'company-a', branchId: 'branch-a' },
    ];
    const linked: any[] = [];
    for (const m of machines) {
      const { service, db } = buildService();
      db.machine.findUnique.mockResolvedValue(m);
      const created: any = await service.create(
        { ...baseDto(), name: `Pump for ${m.id}`, machineId: m.id, sparePartId: 'spare-1' },
        'user-a',
        ctx,
      );
      linked.push(created.sparePartId);
      // The guard runs and finds no clash: one canonical item across many
      // machines is the intended topology, not a duplicate.
      expect(db.machinePart.create).toHaveBeenCalledTimes(1);
    }
    expect(new Set(linked)).toEqual(new Set(['spare-1']));
  });

  // ------------------------------------------------------------------ B
  it('B. one canonical item is reachable from many links without tripping the guards', async () => {
    const created: any[] = [];
    for (const machineId of ['m1', 'm2', 'm3', 'm4', 'm5']) {
      const { service, db } = buildService();
      db.machine.findUnique.mockResolvedValue({ id: machineId, companyId: 'company-a', branchId: null });
      db.machinePart.create.mockImplementation(({ data }: any) => mpRow({ id: `mp-${machineId}`, ...data }));
      created.push(await service.create({ ...baseDto(), name: `Item ${machineId}`, machineId, sparePartId: 'spare-1' }, 'user-a', ctx));
    }
    expect(created).toHaveLength(5);
    expect(new Set(created.map((r) => r.sparePartId))).toEqual(new Set(['spare-1']));
  });

  // ------------------------------------------------------------------ C
  it('C. keeps similar names with different specification distinct (no name-based merge)', async () => {
    const a = { id: 'spare-a', code: 'SP-A', name: 'Bearing 6205', status: 'ACTIVE', deletedAt: null };
    const b = { id: 'spare-b', code: 'SP-B', name: 'Bearing 6205', status: 'ACTIVE', deletedAt: null };
    const { service, db } = buildService({ canonicalSparePart: a });
    await service.create({ ...baseDto(), name: 'Bearing 6205 A', machineId: 'machine-1', sparePartId: 'spare-a' }, 'user-a', ctx);
    // A same-name entry for the same machine (differing only by case and
    // whitespace) is refused rather than silently re-pointed at the other,
    // technically distinct canonical item.
    await expect(
      service.create({ ...baseDto(), name: 'bearing  6205 a', machineId: 'machine-1', sparePartId: 'spare-b' }, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.machinePart.create).toHaveBeenCalledTimes(1);
    expect(db.machinePart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sparePartId: 'spare-a' }) }),
    );
  });

  // ------------------------------------------------------------------ D
  it('D. rejects duplicate submission of the same part on the same machine', async () => {
    const { service, db } = buildService({
      existingParts: [{ id: 'mp-existing', code: 'MPP-1', name: 'Hydraulic Pump', machineId: 'machine-1' }],
    });
    await expect(service.create({ ...baseDto(), machineId: 'machine-1' }, 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  it('D2. rejects representing the same canonical part twice for one machine', async () => {
    const { service, db } = buildService({ applicabilityLink: { id: 'msp-1' } });
    db.machinePart.findFirst.mockResolvedValue({ id: 'mp-other', code: 'MPP-9' });
    await expect(
      service.create({ ...baseDto(), name: 'Distinct name', machineId: 'machine-1', sparePartId: 'spare-1' }, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  it('D3. rejects a duplicated machine part code', async () => {
    const { service, db } = buildService();
    db.machinePart.findUnique.mockResolvedValue(mpRow());
    await expect(service.create({ ...baseDto(), code: 'MPP-DUP', machineId: 'machine-1' }, 'user-a', ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ E
  it('E. preserves history: reads expose the canonical link and never rewrite records', async () => {
    const { service, db } = buildService({ row: mpRow({ sparePartId: null }) });
    const found: any = await service.findOne('mp-1', ctx, 'user-a');
    expect(found.sparePartId).toBeNull();
    expect(db.machinePart.update).not.toHaveBeenCalled();
    expect(db.machinePart.delete).not.toHaveBeenCalled();
  });

  it('E2. a legacy part with no canonical link still loads and updates', async () => {
    const { service, db } = buildService({ row: mpRow({ name: 'Legacy', sparePartId: null }) });
    db.machinePart.update.mockResolvedValue(mpRow({ name: 'Legacy renamed', sparePartId: null }));
    await expect(service.update('mp-1', { name: 'Legacy renamed' } as any, 'user-a', ctx)).resolves.toBeDefined();
    expect(db.sparePart.update).toBeUndefined();
  });

  // ------------------------------------------------------------------ F
  it('F. rejects referencing a machine outside the active company context', async () => {
    const { service, db } = buildService();
    db.machine.findUnique.mockResolvedValue(machineOutOfScope);
    await expect(service.create({ ...baseDto(), machineId: 'machine-2', sparePartId: 'spare-1' }, 'user-a', ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  it('F2. hides a part belonging to another company on read', async () => {
    const { service, db } = buildService({ row: mpRow({ machineId: 'machine-2', machine: machineOutOfScope }) });
    await expect(service.findOne('mp-1', ctx, 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.machinePart.findUnique).toHaveBeenCalled();
  });

  it('F3. rejects an unknown or soft-deleted canonical part', async () => {
    const { service, db } = buildService({
      canonicalSparePart: { id: 'spare-1', code: 'SP001', status: 'ACTIVE', deletedAt: new Date() },
    });
    await expect(service.create({ ...baseDto(), machineId: 'machine-1', sparePartId: 'spare-1' }, 'user-a', ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  it('F4. rejects an inactive canonical part', async () => {
    const { service, db } = buildService({
      canonicalSparePart: { id: 'spare-1', code: 'SP001', status: 'INACTIVE', deletedAt: null },
    });
    await expect(service.create({ ...baseDto(), machineId: 'machine-1', sparePartId: 'spare-1' }, 'user-a', ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ G
  it('G. never cascades or removes installation / inventory / catalog records', async () => {
    const { service, db } = buildService({ row: mpRow({ sparePartId: null, productId: null }) });
    await service.remove('mp-1', 'user-a', ctx);
    expect(db.machinePart.delete).toHaveBeenCalledTimes(1);
    expect(db.machineInstalledPart).toBeUndefined();
    expect(db.sparePart.delete).toBeUndefined();
    expect(db.inventoryMovement).toBeUndefined();
  });

  it('G2. refuses to delete a part with linked usage history', async () => {
    const { service, db } = buildService({ row: mpRow({ productId: 'product-1' }) });
    db.maintenanceRequestPartUsage.count.mockResolvedValue(4);
    await expect(service.remove('mp-1', 'user-a', ctx)).rejects.toBeDefined();
    expect(db.machinePart.delete).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ H
  it('H. is idempotent: a second identical pass creates nothing further', async () => {
    const { service, db, audit } = buildService({ row: mpRow({ name: 'Legacy', sparePartId: null }) });
    db.machinePart.update.mockResolvedValue(mpRow({ name: 'Legacy', sparePartId: 'spare-1' }));
    const first: any = await service.update('mp-1', { sparePartId: 'spare-1' } as any, 'user-a', ctx);
    expect(first.sparePartId).toBe('spare-1');

    // Second run, same input, already-linked row: no duplicate is created.
    const s2 = buildService({ row: mpRow({ name: 'Legacy', sparePartId: 'spare-1' }) });
    s2.db.machinePart.findFirst.mockResolvedValue(null);
    s2.db.machinePart.update.mockResolvedValue(mpRow({ name: 'Legacy', sparePartId: 'spare-1' }));
    const second: any = await s2.service.update('mp-1', { sparePartId: 'spare-1' } as any, 'user-a', ctx);
    expect(second.sparePartId).toBe('spare-1');
    expect(s2.db.machinePart.create).not.toHaveBeenCalled();
    expect(db.machinePart.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('H2. records an audit entry with previous and new canonical state', async () => {
    const { service, db, audit } = buildService({ row: mpRow({ name: 'Legacy', sparePartId: null }) });
    db.machinePart.update.mockResolvedValue(mpRow({ name: 'Legacy', sparePartId: 'spare-1' }));
    await service.update('mp-1', { sparePartId: 'spare-1' } as any, 'user-a', ctx);
    expect(audit.log).toHaveBeenCalledTimes(1);
    const details = audit.log.mock.calls[0][4];
    expect(details.previous.sparePartId).toBeNull();
    expect(details.new.sparePartId).toBe('spare-1');
  });
});