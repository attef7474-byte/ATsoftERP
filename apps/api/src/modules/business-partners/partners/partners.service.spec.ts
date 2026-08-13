import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessPartnersService } from './partners.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const partner = (overrides: Record<string, any> = {}) => ({
  id: 'bp1',
  code: 'BP-0001',
  name: 'Partner 1',
  companyId: 'c1',
  branchId: 'b1',
  deletedAt: null,
  group: null,
  paymentTerm: null,
  contacts: [],
  addresses: [],
  bankAccounts: [],
  ...overrides,
});

describe('BusinessPartnersService tenant isolation', () => {
  let prisma: any;
  let service: BusinessPartnersService;

  beforeEach(() => {
    prisma = {
      businessPartner: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new BusinessPartnersService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('never writes client-provided tenant fields from the DTO', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      prisma.businessPartner.create.mockResolvedValue(partner());

      const result = await service.create(
        {
          code: 'BP-0001',
          name: 'Partner 1',
          companyId: 'c2',
          branchId: 'b2',
        } as any,
        ctx,
      );

      expect(result).toBeDefined();
      expect(prisma.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }),
        }),
      );
      const data = prisma.businessPartner.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c1');
      expect(data.branchId).toBe('b1');
      expect(data.companyId).not.toBe('c2');
      expect(data.branchId).not.toBe('b2');
    });

    it('rejects a duplicate code regardless of tenant', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner());

      await expect(
        service.create({ code: 'BP-0001', name: 'Partner 1' } as any, ctx),
      ).rejects.toThrow(ConflictException);
      expect(prisma.businessPartner.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('rejects reading a partner that belongs to another company', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ companyId: 'c2' }));

      await expect(service.findOne('bp1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rejects reading a partner that belongs to another branch', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ branchId: 'b2' }));

      await expect(service.findOne('bp1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the partner does not exist', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects updating a partner that belongs to another company', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ companyId: 'c2' }));

      await expect(
        service.update('bp1', { name: 'Hacked' } as any, ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.businessPartner.update).not.toHaveBeenCalled();
    });

    it('rejects updating a partner that belongs to another branch', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ branchId: 'b2' }));

      await expect(
        service.update('bp1', { name: 'Hacked' } as any, ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.businessPartner.update).not.toHaveBeenCalled();
    });

    it('strips tenant fields from the update payload (no ownership stealing)', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner());
      prisma.businessPartner.update.mockResolvedValue(partner());

      const result = await service.update(
        'bp1',
        { name: 'Renamed', companyId: 'c2', branchId: 'b2' } as any,
        ctx,
      );

      expect(result).toBeDefined();
      const data = prisma.businessPartner.update.mock.calls[0][0].data;
      expect(data.name).toBe('Renamed');
      expect(data).not.toHaveProperty('companyId');
      expect(data).not.toHaveProperty('branchId');
      expect(prisma.businessPartner.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp1' } }),
      );
    });
  });

  describe('remove', () => {
    it('rejects deleting a partner that belongs to another company', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ companyId: 'c2' }));

      await expect(service.remove('bp1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.businessPartner.update).not.toHaveBeenCalled();
    });

    it('rejects deleting a partner that belongs to another branch', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner({ branchId: 'b2' }));

      await expect(service.remove('bp1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.businessPartner.update).not.toHaveBeenCalled();
    });

    it('soft-deletes only an owned partner', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(partner());
      prisma.businessPartner.update.mockResolvedValue(partner({ deletedAt: new Date() }));

      const result = await service.remove('bp1', ctx);

      expect(result).toEqual({ message: 'Business partner deleted successfully' });
      expect(prisma.businessPartner.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
