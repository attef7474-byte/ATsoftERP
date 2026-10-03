import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MachinePartsService } from './machine-parts.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';

/**
 * R4O regression suite: MachinePart tenant ownership, unresolved-ownership
 * quarantine, and canonical SparePart selection integrity.
 *
 * Mandated scenarios:
 *  A. Ownership of a NEW part-list row is derived from the authenticated
 *     operational context or from an authorized Machine - never from the client.
 *  B. A part owned by another company is invisible, unwritable and undeletable
 *     by an ordinary tenant.
 *  C. A part whose ownership is UNPROVEN (NULL columns) is quarantined for
 *     SUPER_ADMIN only, instead of being exposed to every tenant.
 *  D. Link / unlink keep ownership consistent with the machine relationship.
 *  E. Production selection cannot link a non-ACTIVE canonical SparePart, so a
 *     test-only or deactivated catalog item cannot bypass the R4N canonical rule.
 */

const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;

const machineInScope = { id: 'machine-1', code: 'M-1', name: 'Lathe', companyId: 'company-a', branchId: 'branch-a' };

const baseDb = (over: any = {}) => ({
  machine: {
    findUnique: jest.fn().mockResolvedValue(machineInScope),
    findMany: jest.fn().mockResolvedValue([{ id: 'machine-1' }]),
    ...over.machine,
  },
  machinePart: {
    findUnique: jest.fn().mockResolvedValue(over.row ?? null),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mp-new', code: data.code, ...data })),
    update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mp-1', code: 'MPP-1', ...data })),
    delete: jest.fn().mockResolvedValue({}),
    ...over.machinePart,
  },
  machineSparePart: { findFirst: jest.fn().mockResolvedValue(null), ...over.machineSparePart },
  sparePart: { findUnique: jest.fn().mockResolvedValue(over.sparePart ?? null), ...over.sparePart },
  product: { findUnique: jest.fn().mockResolvedValue(null), ...over.product },
  maintenanceRequestPartUsage: { count: jest.fn().mockResolvedValue(0) },
});

const build = (over: any = {}, isSuperAdmin = false) => {
  const db = baseDb(over);
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const numbering: any = { generateNumberAtomic: jest.fn().mockResolvedValue('MPP-1') };
  const resolver: any = { getAuthorization: jest.fn().mockResolvedValue({ isSuperAdmin }) };
  return { service: new MachinePartsService(db as any, audit, numbering, resolver), db, audit, resolver };
};

describe('R4O MachinePart tenant ownership (MachinePartsService)', () => {
  // ------------------------------------------------------------------ A
  describe('A. ownership is derived, never supplied by the client', () => {
    it('A1. an unbound part inherits the authenticated operational context', async () => {
      const { service, db } = build();
      await service.create({ name: 'Orphan Pump', unit: 'pcs', quantity: 1, minStock: 0 } as any, 'user-a', ctx);

      expect(db.machinePart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'MPP-1', companyId: 'company-a', branchId: 'branch-a' }),
      });
    });

    it('A2. a bound part inherits the authorized machine tenant, not the context', async () => {
      const { service, db } = build({
        machine: { findUnique: jest.fn().mockResolvedValue({ ...machineInScope, companyId: 'company-a', branchId: null }) },
      });
      await service.create({ name: 'Pump', unit: 'pcs', quantity: 1, minStock: 0, machineId: 'machine-1' } as any, 'user-a', ctx);

      // The machine is company-owned at company level, so branchId must be NULL
      // rather than copied from the caller's branch.
      expect(db.machinePart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: null }),
      });
    });

    it('A3. the create DTO exposes no ownership field, so a client cannot claim a tenant', () => {
      const declared = Object.getOwnPropertyNames(new CreateMachinePartDto());
      expect(declared).not.toContain('companyId');
      expect(declared).not.toContain('branchId');
      // Global ValidationPipe runs with forbidNonWhitelisted, so a submitted
      // ownership field is rejected as an unknown property.
      expect(declared).toEqual(expect.arrayContaining(['name', 'unit']));
    });

    it('A4. a machine from another company is refused before any row is written', async () => {
      const { service, db } = build({
        machine: { findUnique: jest.fn().mockResolvedValue({ id: 'mX', companyId: 'company-b', branchId: 'branch-b' }) },
      });
      await expect(
        service.create({ name: 'Pump', unit: 'pcs', machineId: 'mX' } as any, 'user-a', ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.machinePart.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ B
  describe('B. cross-tenant isolation on an unbound part', () => {
    it('B1. hides an unbound part owned by a different company', async () => {
      const { service, resolver } = build({
        row: { id: 'mp-x', machineId: null, companyId: 'company-b', branchId: 'branch-b' },
      });
      await expect(service.findOne('mp-x', ctx, 'user-a')).rejects.toBeInstanceOf(NotFoundException);
      // Authority is never even consulted for a row another tenant owns.
      expect(resolver.getAuthorization).not.toHaveBeenCalled();
    });

    it('B2. blocks update of an unbound part owned by a different company', async () => {
      const { service, db } = build({
        row: { id: 'mp-x', machineId: null, companyId: 'company-b', branchId: null },
      });
      await expect(service.update('mp-x', { name: 'Renamed' } as any, 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(db.machinePart.update).not.toHaveBeenCalled();
    });

    it('B3. blocks delete of an unbound part owned by a different company', async () => {
      const { service, db } = build({
        row: { id: 'mp-x', machineId: null, companyId: 'company-b', branchId: null },
      });
      await expect(service.remove('mp-x', 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(db.machinePart.delete).not.toHaveBeenCalled();
    });

    it('B4. rejects a branch that does not match the branch-owned part', async () => {
      const { service } = build({
        row: { id: 'mp-x', machineId: null, companyId: 'company-a', branchId: 'branch-z' },
      });
      await expect(service.findOne('mp-x', ctx, 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('B5. allows a company-owned part (branchId NULL) from any branch of that company', async () => {
      const { service } = build({
        row: { id: 'mp-ok', machineId: null, companyId: 'company-a', branchId: null },
      });
      await expect(service.findOne('mp-ok', ctx, 'user-a')).resolves.toBeDefined();
    });

    it('B6. list scoping exposes owned unbound rows only, and never every unbound row', async () => {
      const { service, db } = build();
      await service.findAll({}, ctx, 'user-a');

      const where = db.machinePart.findMany.mock.calls[0][0].where;
      // The pre-R4O predicate was a bare { machineId: null }, which handed every
      // unbound row to every tenant. Ownership must now be an explicit clause.
      expect(where.OR).toEqual(expect.arrayContaining([
        expect.objectContaining({ machineId: null, companyId: 'company-a' }),
      ]));
      expect(where.OR.some((clause: any) => 'machineId' in clause && clause.machineId === null && !('companyId' in clause))).toBe(false);
    });
  });

  // ------------------------------------------------------------------ C
  describe('C. unproven ownership is quarantined for SUPER_ADMIN only', () => {
    it('C1. an ordinary tenant cannot read an unowned part', async () => {
      const { service, db } = build({ row: { id: 'mp-o', machineId: null, companyId: null, branchId: null } });
      await expect(service.findOne('mp-o', ctx, 'user-a')).rejects.toBeInstanceOf(NotFoundException);
      expect(db.machinePart.findUnique).toHaveBeenCalled();
    });

    it('C2. an ordinary tenant cannot delete an unowned part', async () => {
      const { service, db } = build({ row: { id: 'mp-o', machineId: null, companyId: null, branchId: null } });
      await expect(service.remove('mp-o', 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(db.machinePart.delete).not.toHaveBeenCalled();
    });

    it('C3. a re-resolved SUPER_ADMIN can still read an unowned part to reconcile it', async () => {
      const { service, resolver } = build(
        { row: { id: 'mp-o', machineId: null, companyId: null, branchId: null } },
        true,
      );
      await expect(service.findOne('mp-o', ctx, 'admin-1')).resolves.toBeDefined();
      expect(resolver.getAuthorization).toHaveBeenCalledWith('admin-1');
    });

    it('C4. the unowned quarantine clause is added to the list only for SUPER_ADMIN', async () => {
      const { service: admin, db } = build({}, true);
      await admin.findAll({}, ctx, 'admin-1');
      const adminWhere = db.machinePart.findMany.mock.calls[0][0].where;
      expect(adminWhere.OR).toEqual(expect.arrayContaining([
        expect.objectContaining({ machineId: null, companyId: null }),
      ]));
    });

    it('C5. a normal tenant list never includes the unowned clause', async () => {
      const { service, db } = build();
      await service.findAll({}, ctx, 'user-a');
      const where = db.machinePart.findMany.mock.calls[0][0].where;
      expect(where.OR).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ machineId: null, companyId: null }),
      ]));
    });

    it('C6. a part bound to a machine is judged by the machine, not the columns', async () => {
      const { service } = build({
        row: { id: 'mp-b', machineId: 'machine-1', companyId: null, branchId: null, machine: machineInScope },
      });
      await expect(service.findOne('mp-b', ctx, 'user-a')).resolves.toBeDefined();
    });
  });

  // ------------------------------------------------------------------ D
  describe('D. link / unlink keep ownership consistent', () => {
    it('D1. link re-derives ownership from the authorized machine', async () => {
      const { service, db, audit } = build({
        row: { id: 'mp-o', code: 'MPP-1', machineId: null, companyId: 'company-a', branchId: null },
      });
      await service.linkToMachine('mp-o', 'machine-1', 'user-a', ctx);

      expect(db.machinePart.update).toHaveBeenCalledWith({
        where: { id: 'mp-o' },
        data: { machineId: 'machine-1', companyId: 'company-a', branchId: 'branch-a' },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'user-a', 'LINK', 'MachinePart', 'mp-o',
        expect.objectContaining({
          previous: expect.objectContaining({ companyId: 'company-a', branchId: null }),
          new: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
        }),
      );
    });

    it('D1b. an ordinary tenant cannot adopt an UNOWNED part by linking it to a machine', async () => {
      const { service, db } = build({
        row: { id: 'mp-o', code: 'MPP-1', machineId: null, companyId: null, branchId: null },
      });
      // Claiming a part whose owner no evidence can prove would defeat the
      // quarantine, so the link is refused before any write.
      await expect(service.linkToMachine('mp-o', 'machine-1', 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(db.machinePart.update).not.toHaveBeenCalled();
    });

    it('D1c. SUPER_ADMIN can link an unowned part and ownership is then re-derived', async () => {
      const { service, db } = build(
        { row: { id: 'mp-o', code: 'MPP-1', machineId: null, companyId: null, branchId: null } },
        true,
      );
      await service.linkToMachine('mp-o', 'machine-1', 'admin-1', ctx);
      expect(db.machinePart.update).toHaveBeenCalledWith({
        where: { id: 'mp-o' },
        data: { machineId: 'machine-1', companyId: 'company-a', branchId: 'branch-a' },
      });
    });

    it('D2. unlink clears ownership back to unproven and records the change', async () => {
      const { service, db, audit } = build({
        row: {
          id: 'mp-b', code: 'MPP-1', machineId: 'machine-1',
          companyId: 'company-a', branchId: 'branch-a', machine: machineInScope,
        },
      });
      await service.unlinkFromMachine('mp-b', 'machine-1', 'user-a', ctx);

      expect(db.machinePart.update).toHaveBeenCalledWith({
        where: { id: 'mp-b' },
        // Ownership is NOT retained: after an unlink the owner is unprovable.
        data: { machineId: null, companyId: null, branchId: null },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'user-a', 'UNLINK', 'MachinePart', 'mp-b',
        expect.objectContaining({
          previous: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
          new: expect.objectContaining({ companyId: null, branchId: null }),
        }),
      );
    });

    it('D3. reassigning a part re-derives ownership from the new machine', async () => {
      const { service, db } = build({
        row: {
          id: 'mp-b', code: 'MPP-1', name: 'Pump', machineId: 'machine-1',
          companyId: 'company-a', branchId: 'branch-a', machine: machineInScope,
          sparePartId: null,
        },
        // The new machine is inside the same company but company-owned
        // (branchId NULL), so a stale branch-a claim must not be retained.
        machine: {
          findUnique: jest.fn().mockResolvedValue({ id: 'machine-2', companyId: 'company-a', branchId: null }),
        },
      });
      await service.update('mp-b', { machineId: 'machine-2' } as any, 'user-a', ctx);

      expect(db.machinePart.update).toHaveBeenCalledWith({
        where: { id: 'mp-b' },
        data: expect.objectContaining({ machineId: 'machine-2', companyId: 'company-a', branchId: null }),
      });
    });

    it('D4. reassignment to a machine outside the branch scope is refused', async () => {
      const { service, db } = build({
        row: {
          id: 'mp-b', code: 'MPP-1', name: 'Pump', machineId: 'machine-1',
          companyId: 'company-a', branchId: 'branch-a', machine: machineInScope,
          sparePartId: null,
        },
        machine: {
          findUnique: jest.fn().mockResolvedValue({ id: 'machine-9', companyId: 'company-a', branchId: 'branch-z' }),
        },
      });
      await expect(service.update('mp-b', { machineId: 'machine-9' } as any, 'user-a', ctx)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.machinePart.update).not.toHaveBeenCalled();
    });
  });
});

describe('R4O canonical SparePart selection integrity', () => {
  const canonical = { id: 'spare-1', code: 'SP001', name: 'Bearing', status: 'ACTIVE', deletedAt: null };

  it('E1. a machine applicability link requires an ACTIVE canonical part', async () => {
    const { MachineSparePartsService } = require('../machine-spare-parts/machine-spare-parts.service');
    const linkCtx = { companyId: 'company-a', branchId: 'branch-a' } as any;
    const tx: any = {
      machine: { findFirst: jest.fn().mockResolvedValue({ id: 'machine-1' }) },
      sparePart: { findFirst: jest.fn().mockResolvedValue(null) },
      machineSparePart: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new MachineSparePartsService(tx as any, { logWithClient: jest.fn() } as any);

    await expect(
      service.create({ machineId: 'machine-1', sparePartId: 'spare-1', quantity: 1 } as any, 'user-a', linkCtx),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The guard must filter on status, otherwise a deactivated or test-only item
    // could still be attached to a machine and bypass the R4N canonical rule.
    expect(tx.sparePart.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'spare-1', deletedAt: null, status: 'ACTIVE' }) }),
    );
    expect(tx.machineSparePart.create).not.toHaveBeenCalled();
  });

  it('E2. a component applicability link requires an ACTIVE canonical part', async () => {
    const { ComponentSparePartsService } = require('../component-spare-parts/component-spare-parts.service');
    const linkCtx = { companyId: 'company-a', branchId: 'branch-a' } as any;
    const tx: any = {
      machineComponent: { findFirst: jest.fn().mockResolvedValue({ id: 'component-1' }) },
      sparePart: { findFirst: jest.fn().mockResolvedValue(null) },
      componentSparePart: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new ComponentSparePartsService(tx as any, { logWithClient: jest.fn() } as any);

    await expect(
      service.create({ componentId: 'component-1', sparePartId: 'spare-1', quantity: 1 } as any, 'user-a', linkCtx),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sparePart.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'spare-1', deletedAt: null, status: 'ACTIVE' }) }),
    );
    expect(tx.componentSparePart.create).not.toHaveBeenCalled();
  });

  it('E3. the canonical MachinePart rule already rejects an INACTIVE or deleted part', async () => {
    const { service, db } = build({ sparePart: { ...canonical, status: 'INACTIVE' } });
    await expect(
      service.create({ name: 'Pump', unit: 'pcs', sparePartId: 'spare-1' } as any, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.machinePart.create).not.toHaveBeenCalled();
  });

  it('E4. an ACTIVE canonical part is accepted and the part-list row is owned by the context', async () => {
    const { service, db } = build({ sparePart: canonical });
    await service.create({ name: 'Pump', unit: 'pcs', sparePartId: 'spare-1' } as any, 'user-a', ctx);
    expect(db.machinePart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sparePartId: 'spare-1', companyId: 'company-a', branchId: 'branch-a' }),
    });
  });
});