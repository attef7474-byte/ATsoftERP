import { NotFoundException } from '@nestjs/common';
import { ProductionOperationalPeopleService } from './production-operational-people.service';

const person = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  code: 'EMP-001',
  name: 'Ahmed Hassan',
  category: 'MAINTENANCE',
  isActive: true,
  phone: null,
  email: null,
  notes: null,
  ...overrides,
});

describe('ProductionOperationalPeopleService', () => {
  let prisma: any;
  let service: ProductionOperationalPeopleService;

  beforeEach(() => {
    prisma = {
      operationalPerson: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new ProductionOperationalPeopleService(prisma);
  });

  describe('findAll', () => {
    it('returns people with pagination meta', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([person()]);
      prisma.operationalPerson.count.mockResolvedValue(1);

      const result = await service.findAll({ search: 'ahmed', page: 1, limit: 10 });

      expect(prisma.operationalPerson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
          skip: 0,
          take: 10,
          orderBy: { name: 'asc' },
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(result.data[0].code).toBe('EMP-001');
    });

    it('filters by isActive when provided', async () => {
      prisma.operationalPerson.findMany.mockResolvedValue([]);
      prisma.operationalPerson.count.mockResolvedValue(0);

      await service.findAll({ isActive: 'false', page: 1, limit: 10 });

      const where = prisma.operationalPerson.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });
  });

  describe('findOne', () => {
    it('returns the person', async () => {
      prisma.operationalPerson.findUnique.mockResolvedValue(person());
      const result = await service.findOne('p1');
      expect(result.id).toBe('p1');
    });

    it('throws NotFoundException when missing', async () => {
      prisma.operationalPerson.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
});