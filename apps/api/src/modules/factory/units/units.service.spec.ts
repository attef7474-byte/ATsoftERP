import { ConflictException, NotFoundException } from '@nestjs/common';
import { UnitsService } from './units.service';

/**
 * Global canonical Unit master — focused API tests.
 *
 * The unit master is ERP-wide reference data (not tenant scoped). It must not be
 * hard-deleted while referenced, and codes are stored in a normalized form so the
 * same physical unit cannot be created twice under different casing.
 */
describe('UnitsService', () => {
  const build = () => {
    const prisma: any = {
      unit: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((a: any) => Promise.resolve({ id: 'u-new', ...a.data })),
        update: jest.fn().mockImplementation((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    return { prisma, service: new UnitsService(prisma) };
  };

  it('U1: create normalizes the code to upper-case and defaults to active', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue(null);
    await service.create({ code: '  pcs ', nameAr: 'قطعة', nameEn: 'Pieces', symbol: 'pc' } as any);
    expect(prisma.unit.create).toHaveBeenCalledWith({
      data: { code: 'PCS', nameAr: 'قطعة', nameEn: 'Pieces', symbol: 'pc', isActive: true },
    });
  });

  it('U2: create rejects a duplicate code', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-pcs', code: 'PCS' });
    await expect(service.create({ code: 'pcs', nameAr: 'x', nameEn: 'x' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.unit.create).not.toHaveBeenCalled();
  });

  it('U3: findAll can restrict to active units only', async () => {
    const { prisma, service } = build();
    await service.findAll({ activeOnly: 'true', search: 'pc' });
    const where = prisma.unit.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toHaveLength(4);
  });

  it('U4: findOne throws when the unit does not exist', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('U5: a referenced unit cannot be hard-deleted', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-pcs', code: 'PCS', _count: { products: 13, spareParts: 4, machineParts: 0 } });
    await expect(service.remove('unit-pcs')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.unit.delete).not.toHaveBeenCalled();
  });

  it('U6: an unreferenced unit can be deleted', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-x', code: 'X', _count: { products: 0, spareParts: 0, machineParts: 0 } });
    const res = await service.remove('unit-x');
    expect(prisma.unit.delete).toHaveBeenCalledWith({ where: { id: 'unit-x' } });
    expect(res).toMatchObject({ message: expect.any(String) });
  });

  it('U7: activate and deactivate toggle isActive', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique.mockResolvedValue({ id: 'unit-pcs', code: 'PCS', _count: { products: 0, spareParts: 0, machineParts: 0 } });
    await service.activate('unit-pcs');
    await service.deactivate('unit-pcs');
    expect(prisma.unit.update.mock.calls[0][0]).toMatchObject({ where: { id: 'unit-pcs' }, data: { isActive: true } });
    expect(prisma.unit.update.mock.calls[1][0]).toMatchObject({ where: { id: 'unit-pcs' }, data: { isActive: false } });
  });

  it('U8: renaming a unit code onto an existing code is rejected', async () => {
    const { prisma, service } = build();
    prisma.unit.findUnique
      .mockResolvedValueOnce({ id: 'unit-a', code: 'AAA', _count: { products: 0, spareParts: 0, machineParts: 0 } })
      .mockResolvedValueOnce({ id: 'unit-b', code: 'BBB' });
    await expect(service.update('unit-a', { code: 'bbb' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.unit.update).not.toHaveBeenCalled();
  });
});
