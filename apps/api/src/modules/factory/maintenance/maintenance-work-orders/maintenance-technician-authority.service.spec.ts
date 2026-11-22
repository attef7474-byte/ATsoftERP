import { NotFoundException } from '@nestjs/common';
import { MaintenanceTechnicianAuthorityService } from './maintenance-technician-authority.service';

describe('MaintenanceTechnicianAuthorityService', () => {
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  let prisma: any;
  let service: MaintenanceTechnicianAuthorityService;

  const person = (mpId = 'mp1', userId = 'u1') => ({
    id: 'op1', code: 'T1', name: 'Tech', isActive: true,
    maintenancePersonnel: { id: mpId, role: 'TECHNICIAN', specialty: 'MECH', isActive: true },
    assignments: [{ department: { name: 'Maint' }, jobTitle: null, branch: { name: 'Branch 1' } }],
  });

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new MaintenanceTechnicianAuthorityService(prisma);
  });

  it('rejects missing operational context', async () => {
    await expect(service.byPersonnel('mp1', null as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.byUser('u1', { companyId: 'c1' } as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.candidates({} as any, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves a technician only inside active tenant/branch/current-assignment scope', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', operationalPeople: [person()] }]);
    const result = await service.byPersonnel('mp1', ctx);
    const call = prisma.user.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('ACTIVE');
    expect(call.where.AND).toEqual([
      { OR: [{ companyId: 'c1' }, { companyId: null }] },
      { OR: [{ branchId: 'b1' }, { branchId: null }] },
    ]);
    expect(call.where.operationalPeople.some.maintenancePersonnel).toEqual({ id: 'mp1', isActive: true });
    expect(call.where.operationalPeople.some.assignments.some).toMatchObject({ companyId: 'c1', branchId: 'b1', deletedAt: null });
    expect(result).toMatchObject({ maintenancePersonnelId: 'mp1', userId: 'u1', code: 'T1' });
  });

  it('returns null for foreign/inactive/out-of-scope personnel without leaking existence', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await expect(service.byPersonnel('foreign', ctx)).resolves.toBeNull();
  });

  it('lists candidates only from scoped active canonical chain', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', operationalPeople: [person()] }]);
    const result = await service.candidates({ limit: 10, page: 1 }, ctx);
    expect(prisma.user.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        AND: [
          { OR: [{ companyId: 'c1' }, { companyId: null }] },
          { OR: [{ branchId: 'b1' }, { branchId: null }] },
        ],
      }),
    }));
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({ id: 'mp1', maintenancePersonnelId: 'mp1', userId: 'u1' });
  });
});
