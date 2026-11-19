import { MachineComponentsService } from './machine-components.service';

/**
 * Focused tests for the corrected aggregate: ONE MachineComponent row with many
 * explicit MachineComponentMachine associations. Covers create, edit, parent
 * rules, tenant isolation, listing/filtering, and audit correlation.
 */
describe('MachineComponentsService — one shared component, many active machines', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
  const foreignCtx = { companyId: 'company-b', branchId: 'branch-b' } as any;
  const userId = 'user-1';

  const mkMachine = (id: string, code: string, over: any = {}) => ({
    id, code, name: `Machine ${code}`, companyId: 'company-a', branchId: 'branch-a',
    status: 'ACTIVE', deletedAt: null, ...over,
  });

  type State = { component: any; links: any[] };
  const buildService = (machines: any[], initial?: State) => {
    const state: State = initial
      ? { component: { ...initial.component }, links: initial.links.map((l) => ({ ...l })) }
      : { component: null, links: [] };
    let linkSeq = 0;
    const now = new Date('2026-11-19T10:00:00Z');

    const present = (c: any) => {
      if (!c) return null;
      const links = state.links.filter((l) => l.componentId === c.id && l.status === 'ACTIVE');
      return {
        ...c,
        machineLinks: links.map((l) => ({
          id: l.id,
          machineId: l.machineId,
          status: l.status,
          locationInMachine: l.locationInMachine,
          serialNumber: l.serialNumber,
          linkedAt: l.linkedAt,
          unlinkedAt: l.unlinkedAt,
          machine: machines.find((m) => m.id === l.machineId),
        })),
      };
    };

    const machineComponent = {
      create: jest.fn(async (args: any) => {
        state.component = { id: 'component-1', ...args.data };
        return state.component;
      }),
      update: jest.fn(async (args: any) => {
        state.component = { ...state.component, ...args.data };
        return state.component;
      }),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async (args: any) => {
        const c = state.component;
        if (!c || c.id !== args.where.id || c.deletedAt) return null;
        return present(c);
      }),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    };

    const machineComponentMachine = {
      createMany: jest.fn(async (args: any) => {
        for (const data of args.data) state.links.push({ id: `link-${++linkSeq}`, ...data });
        return { count: args.data.length };
      }),
      updateMany: jest.fn(async (args: any) => {
        for (const link of state.links) {
          if (link.componentId !== args.where.componentId) continue;
          if (args.where.machineId && link.machineId !== args.where.machineId
            && !(args.where.machineId.in && args.where.machineId.in.includes(link.machineId))) continue;
          if (args.where.status && link.status !== args.where.status) continue;
          Object.assign(link, args.data);
        }
        return { count: state.links.length };
      }),
      upsert: jest.fn(async (args: any) => {
        const { componentId, machineId } = args.where.componentId_machineId;
        const existing = state.links.find((l) => l.componentId === componentId && l.machineId === machineId);
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const created = { id: `link-${++linkSeq}`, ...args.create };
        state.links.push(created);
        return created;
      }),
    };

    const tx: any = { machine: { findMany: jest.fn(async () => machines) }, machineComponent, machineComponentMachine, componentSparePart: { count: jest.fn(async () => 0) } };
    const prisma: any = {
      ...tx,
      machineComponent: { ...machineComponent, findMany: jest.fn(async (args: any) => {
        if (args.where?.machineLinks) {
          const linkMachineId = args.where.machineLinks.some.machineId;
          return state.component && state.links.some((l) => l.machineId === linkMachineId && l.status === 'ACTIVE') ? [present(state.component)] : [];
        }
        return state.component ? [present(state.component)] : [];
      }), count: jest.fn(async () => (state.component ? 1 : 0)) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const audit = { log: jest.fn(), logWithClient: jest.fn().mockResolvedValue(undefined) };
    return { service: new MachineComponentsService(prisma, audit as any), audit, prisma, tx, state, present };
  };

  const base = (over: any = {}) => ({
    code: 'CMP-1', name: 'Bearing', componentType: 'MECHANICAL',
    machineIds: ['m-1', 'm-2', 'm-3'], ...over,
  });
  const machines3 = [mkMachine('m-1', 'M1'), mkMachine('m-2', 'M2'), mkMachine('m-3', 'M3')];

  const errorCode = async (thunk: () => Promise<any>): Promise<string | undefined> => {
    try {
      await thunk();
      return undefined;
    } catch (err: any) {
      return typeof err?.getResponse === 'function' ? err.getResponse()?.errors?.[0]?.code : undefined;
    }
  };

  // --- CREATE -------------------------------------------------------------
  it('A1 creates exactly ONE component and N active links for N machines', async () => {
    const { service, tx, state } = buildService(machines3);
    const res = await service.create(base() as any, userId, ctx);

    expect(tx.machineComponent.create).toHaveBeenCalledTimes(1);
    expect(tx.machineComponentMachine.createMany).toHaveBeenCalledTimes(1);
    const linkData = tx.machineComponentMachine.createMany.mock.calls[0][0].data;
    expect(linkData).toHaveLength(3);
    expect(linkData.map((d: any) => d.machineId)).toEqual(['m-1', 'm-2', 'm-3']);
    expect(linkData.every((d: any) => d.componentId === res.id && d.status === 'ACTIVE')).toBe(true);
    expect(res.machines).toHaveLength(3);
    expect(state.links).toHaveLength(3);
  });

  it('A2 batch compatibility endpoint reports one created component, not one per machine', async () => {
    const { service, tx } = buildService(machines3);
    const res: any = await service.createBatch(base() as any, userId, ctx);

    expect(tx.machineComponent.create).toHaveBeenCalledTimes(1);
    expect(res.createdCount).toBe(1);
    expect(res.componentId).toBe('component-1');
    expect(res.createdComponents.map((c: any) => c.machineId)).toEqual(['m-1', 'm-2', 'm-3']);
    expect(new Set(res.createdComponents.map((c: any) => c.id)).size).toBe(1);
  });

  it('A3 dedupes repeated machine ids before creating links', async () => {
    const { service, tx } = buildService(machines3);
    await service.create(base({ machineIds: ['m-1', 'm-1', 'm-2', 'm-2'] }) as any, userId, ctx);
    const linkData = tx.machineComponentMachine.createMany.mock.calls[0][0].data;
    expect(linkData.map((d: any) => d.machineId)).toEqual(['m-1', 'm-2']);
  });

  it('A4 stores machine-specific location/serial on each link, never shared', async () => {
    const { service, tx } = buildService(machines3);
    await service.create(base({
      machineData: [
        { machineId: 'm-1', locationInMachine: 'Top', serialNumber: 'S-1' },
        { machineId: 'm-2', locationInMachine: 'Bottom', serialNumber: 'S-2' },
        { machineId: 'm-3', locationInMachine: 'Side', serialNumber: 'S-3' },
      ],
    }) as any, userId, ctx);
    const linkData = tx.machineComponentMachine.createMany.mock.calls[0][0].data;
    expect(linkData.map((d: any) => d.locationInMachine)).toEqual(['Top', 'Bottom', 'Side']);
    expect(linkData.map((d: any) => d.serialNumber)).toEqual(['S-1', 'S-2', 'S-3']);
  });

  // --- VALIDATION / TENANCY ----------------------------------------------
  it('V1 rejects an empty machine selection without any write', async () => {
    const { service, tx } = buildService(machines3);
    expect(await errorCode(() => service.create(base({ machineIds: [] }) as any, userId, ctx))).toBe('validation.required');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('V2 rejects a foreign machine atomically', async () => {
    const { service, tx } = buildService([mkMachine('m-1', 'M1')]);
    expect(await errorCode(() => service.create(base({ machineIds: ['m-1', 'm-2'] }) as any, userId, ctx))).toBe('validation.invalidReference');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
  });

  it('V3 rejects inactive and soft-deleted machines atomically', async () => {
    const inactive = buildService([mkMachine('m-1', 'M1', { status: 'INACTIVE' })]);
    expect(await errorCode(() => inactive.service.create(base({ machineIds: ['m-1'] }) as any, userId, ctx))).toBe('maintenance.machineInactive');
    const deleted = buildService([mkMachine('m-1', 'M1', { deletedAt: new Date() })]);
    expect(await errorCode(() => deleted.service.create(base({ machineIds: ['m-1'] }) as any, userId, ctx))).toBe('validation.invalidReference');
  });

  it('V4 rejects a shared serial number and an inherited shared parent for multi-machine creates', async () => {
    const serial = buildService(machines3);
    expect(await errorCode(() => serial.service.create(base({ serialNumber: 'SHARED' }) as any, userId, ctx))).toBe('maintenance.batchSerialPerMachineRequired');
  });

  it('V5 rejects a code that already exists for the company and branch', async () => {
    const { service, tx, prisma } = buildService(machines3);
    tx.machineComponent.findFirst.mockResolvedValueOnce({ id: 'existing' });
    expect(await errorCode(() => service.create(base() as any, userId, ctx))).toBe('validation.duplicateValue');
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
    expect(prisma.machineComponent.findFirst).toHaveBeenCalled();
  });

  it('T1 a foreign tenant cannot read a component by its id', async () => {
    const initial: State = { component: { id: 'component-1', code: 'CMP-1', deletedAt: null, companyId: 'company-a', branchId: 'branch-a', parentComponentId: null }, links: [{ id: 'l1', componentId: 'component-1', machineId: 'm-1', status: 'ACTIVE', locationInMachine: null, serialNumber: null, linkedAt: new Date(), unlinkedAt: null }] };
    const { service } = buildService([mkMachine('m-1', 'M1')], initial);
    await expect(service.findOne('component-1', foreignCtx)).rejects.toMatchObject({ status: 404 });
  });

  it('T2 a foreign tenant cannot edit a component by its id', async () => {
    const initial: State = { component: { id: 'component-1', code: 'CMP-1', deletedAt: null, companyId: 'company-a', branchId: 'branch-a', parentComponentId: null }, links: [{ id: 'l1', componentId: 'component-1', machineId: 'm-1', status: 'ACTIVE', locationInMachine: null, serialNumber: null, linkedAt: new Date(), unlinkedAt: null }] };
    const { service, tx } = buildService([mkMachine('m-1', 'M1')], initial);
    expect(await errorCode(() => service.update('component-1', { name: 'Changed' } as any, userId, foreignCtx))).toBeUndefined();
    // The guard throws NotFoundException, not a validation error.
    await expect(service.update('component-1', { name: 'Changed' } as any, userId, foreignCtx)).rejects.toMatchObject({ status: 404 });
    expect(tx.machineComponent.update).not.toHaveBeenCalled();
  });

  // --- EDIT ---------------------------------------------------------------
  const editState = (): State => ({
    component: { id: 'component-1', code: 'CMP-1', name: 'Bearing', componentType: 'MECHANICAL', companyId: 'company-a', branchId: 'branch-a', machineId: 'm-1', parentComponentId: null, status: 'ACTIVE', deletedAt: null },
    links: [
      { id: 'l1', componentId: 'component-1', machineId: 'm-1', status: 'ACTIVE', locationInMachine: 'Top', serialNumber: 'S-1', linkedAt: new Date(), unlinkedAt: null },
      { id: 'l2', componentId: 'component-1', machineId: 'm-2', status: 'ACTIVE', locationInMachine: 'Bottom', serialNumber: 'S-2', linkedAt: new Date(), unlinkedAt: null },
    ],
  });

  it('E1 toAdd/toKeep/toRemove reconciles the active set on the SAME component id', async () => {
    const { service, tx, state } = buildService(machines3, editState());
    const res: any = await service.update('component-1', {
      toKeep: ['m-1'], toRemove: ['m-2'], toAdd: ['m-3'],
      machineData: [{ machineId: 'm-1', locationInMachine: 'Top-new', serialNumber: 'S-1' }, { machineId: 'm-3', locationInMachine: 'Side', serialNumber: 'S-3' }],
    } as any, userId, ctx);

    expect(tx.machineComponent.create).not.toHaveBeenCalled();
    expect(res.id).toBe('component-1');
    expect(res.machines.map((m: any) => m.machineId).sort()).toEqual(['m-1', 'm-3']);
    const inactive = state.links.filter((l) => l.status === 'INACTIVE');
    expect(inactive.map((l) => l.machineId)).toEqual(['m-2']);
    const added = state.links.find((l) => l.machineId === 'm-3');
    expect(added.status).toBe('ACTIVE');
    expect(added.serialNumber).toBe('S-3');
  });

  it('E2 a full machineIds set is also reconciled on the same component id', async () => {
    const { service, tx } = buildService(machines3, editState());
    const res: any = await service.update('component-1', { machineIds: ['m-2', 'm-3'] } as any, userId, ctx);
    expect(tx.machineComponent.create).not.toHaveBeenCalled();
    expect(res.id).toBe('component-1');
    expect(res.machines.map((m: any) => m.machineId).sort()).toEqual(['m-2', 'm-3']);
  });

  it('E3 reactivating an inactive link reuses its association row', async () => {
    const initial = editState();
    initial.links[1].status = 'INACTIVE';
    initial.links[1].unlinkedAt = new Date();
    const { service, tx, state } = buildService(machines3, initial);
    await service.update('component-1', { toAdd: ['m-2'], machineData: [{ machineId: 'm-2', locationInMachine: 'Bottom', serialNumber: 'S-2' }] } as any, userId, ctx);
    expect(tx.machineComponentMachine.upsert).toHaveBeenCalledTimes(1);
    expect(state.links).toHaveLength(2);
    expect(state.links.find((l) => l.machineId === 'm-2')?.status).toBe('ACTIVE');
  });

  it('E4 cannot use machineIds and toAdd/toKeep/toRemove together, nor remove the last machine', async () => {
    const mixed = buildService(machines3, editState());
    expect(await errorCode(() => mixed.service.update('component-1', { machineIds: ['m-1'], toRemove: ['m-2'] } as any, userId, ctx))).toBe('validation.invalidValue');
    const last = buildService(machines3, editState());
    expect(await errorCode(() => last.service.update('component-1', { machineIds: [] } as any, userId, ctx))).toBe('validation.required');
  });

  it('E5 a code is immutable after creation', async () => {
    const { service } = buildService(machines3, editState());
    expect(await errorCode(() => service.update('component-1', { code: 'OTHER' } as any, userId, ctx))).toBe('validation.invalidValue');
  });

  // --- PARENT SUBSET RULE -------------------------------------------------
  it('P1 rejects a parent whose machines do not cover all child machines', async () => {
    const parent: State = {
      component: { id: 'parent-1', code: 'PARENT', deletedAt: null, companyId: 'company-a', branchId: 'branch-a', parentComponentId: null, status: 'ACTIVE' },
      links: [{ id: 'pl1', componentId: 'parent-1', machineId: 'm-1', status: 'ACTIVE', locationInMachine: null, serialNumber: null, linkedAt: new Date(), unlinkedAt: null }],
    };
    const { service } = buildService(machines3, parent);
    expect(await errorCode(() => service.create(base({ parentComponentId: 'parent-1' }) as any, userId, ctx))).toBe('maintenance.parentMachineScopeMismatch');
  });

  it('P2 rejects removing a machine still required by a child component', async () => {
    const initial = editState();
    const { service, tx } = buildService(machines3, initial);
    tx.machineComponent.findMany.mockResolvedValueOnce([{
      id: 'child-1', code: 'CHILD',
      machineLinks: [{ machineId: 'm-2', status: 'ACTIVE' }],
    }]);
    expect(await errorCode(() => service.update('component-1', { toRemove: ['m-2'] } as any, userId, ctx))).toBe('maintenance.parentMachineRemovalBlocked');
  });

  // --- LIST / FILTER ------------------------------------------------------
  it('L1 one row per component, and ?machineId filters by ACTIVE association', async () => {
    const { service, prisma } = buildService(machines3, editState());
    const all: any = await service.findAll({}, ctx);
    expect(all.data).toHaveLength(1);
    expect(all.data[0].machines).toHaveLength(2);

    const filtered: any = await service.findAll({ machineId: 'm-2' }, ctx);
    expect(filtered.data).toHaveLength(1);
    const args = (prisma.machineComponent.findMany as jest.Mock).mock.calls[1][0];
    expect(args.where.machineLinks).toEqual({ some: { machineId: 'm-2', status: 'ACTIVE' } });
  });

  // --- AUDIT --------------------------------------------------------------
  it('A5 create and update audit events carry machine sets and correlation details', async () => {
    const { service, audit } = buildService(machines3, editState());
    await service.create(base() as any, userId, ctx);
    const createDetails = audit.logWithClient.mock.calls[0][1].details;
    expect(createDetails).toMatchObject({ companyId: 'company-a', branchId: 'branch-a', batchSize: 3, machineIds: ['m-1', 'm-2', 'm-3'] });
    expect(typeof createDetails.batchCorrelationId).toBe('string');

    await service.update('component-1', { toRemove: ['m-2'] } as any, userId, ctx);
    const updateDetails = audit.logWithClient.mock.calls[1][1].details;
    expect(updateDetails).toMatchObject({ removedMachines: ['m-2'], beforeMachines: ['m-1', 'm-2', 'm-3'], afterMachines: ['m-1', 'm-3'] });
  });
});
