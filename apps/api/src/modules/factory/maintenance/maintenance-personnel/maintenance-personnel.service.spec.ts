import { MaintenancePersonnelController } from './maintenance-personnel.controller';
import { PERMISSIONS_KEY } from '../../../../common/decorators/permissions.decorator';
import { MaintenancePersonnelService } from './maintenance-personnel.service';
const ctx: any = { companyId: 'company-a', branchId: 'branch-a' };
describe('maintenance personnel identity and scope', () => {
  it('requires the identity and placement permissions when delegating legacy creation', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, MaintenancePersonnelController.prototype.create)).toEqual(['maintenance-personnel:create', 'operational-person:create', 'person-assignment:create']);
  });
  it('delegates legacy creation to canonical registration with placement and actor', async () => {
    const registrations: any = { create: jest.fn().mockResolvedValue({ maintenanceCapability: { id: 'mp' } }) };
    const prisma: any = { maintenancePersonnel: { findFirst: jest.fn().mockResolvedValue({ id: 'mp', operationalPerson: {} }) } };
    const service = new MaintenancePersonnelService(prisma, registrations, {} as any);
    await service.create({ name: ' Ali\tHassan Ahmed Saleh ', phone: '771749776', role: 'TECHNICIAN', departmentId: 'dept' }, ctx, 'actor');
    expect(registrations.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ali Hassan Ahmed Saleh', phone: '+967771749776', placement: { departmentId: 'dept' } }), ctx, 'actor');
    expect(prisma.maintenancePersonnel.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'mp', operationalPerson: { assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } } } });
  });
  it('rejects short names before the legacy write can create unanchored persons', async () => {
    const registrations: any = { create: jest.fn() };
    const service = new MaintenancePersonnelService({} as any, registrations, {} as any);
    await expect(service.create({ name: 'One Two Three', role: 'TECHNICIAN', departmentId: 'dept' }, ctx)).rejects.toThrow();
    expect(registrations.create).not.toHaveBeenCalled();
  });
  it('keeps search and pagination inside the same authorized branch predicate', async () => {
    const prisma: any = { maintenancePersonnel: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new MaintenancePersonnelService(prisma, {} as any, {} as any);
    await service.findAll({ search: 'Ali', page: 2, limit: 5 }, ctx);
    const args = prisma.maintenancePersonnel.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ skip: 5, take: 5, where: { operationalPerson: { assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId } }, OR: expect.any(Array) } } });
    expect(prisma.maintenancePersonnel.count).toHaveBeenCalledWith({ where: args.where });
  });
  it.each(['findOne', 'update', 'activate', 'deactivate', 'remove'])('scopes %s by current company and branch', async method => {
    const prisma: any = { maintenancePersonnel: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service: any = new MaintenancePersonnelService(prisma, {} as any, {} as any);
    await expect(method === 'update' ? service[method]('foreign', {}, ctx) : service[method]('foreign', ctx)).rejects.toThrow();
    expect(prisma.maintenancePersonnel.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'foreign', operationalPerson: { assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId } } } });
  });
});
