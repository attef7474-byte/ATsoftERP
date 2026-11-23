import { BadRequestException } from '@nestjs/common';
import { PerformanceKpisService } from './performance-kpis.service';

describe('PerformanceKpisService', () => {
  const prisma: any = {
    performanceKpiDefinition: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit: any = { log: jest.fn() };
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  let service: PerformanceKpisService;

  beforeEach(() => { jest.resetAllMocks(); service = new PerformanceKpisService(prisma, audit); });

  it('rejects duplicate code on create', async () => {
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ code: 'MAINT_RESPONSE_TIME_AVG', name: 'Response', domain: 'MAINTENANCE_EXECUTION', measurementUnit: 'MINUTES', direction: 'LOWER_IS_BETTER', aggregationType: 'AVERAGE', calculationMode: 'FORMULA', sourceContractKey: 'maintenance.response_time' } as any, ctx, 'u1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid direction', async () => {
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue(null);
    await expect(service.create({ code: 'X', name: 'X', domain: 'GENERAL', measurementUnit: 'COUNT', direction: 'UP_IS_GOOD', aggregationType: 'COUNT', calculationMode: 'COUNT_QUERY', sourceContractKey: 'x' } as any, ctx, 'u1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats code as immutable on update', async () => {
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'k1', companyId: 'c1', code: 'OLD_CODE', status: 'ACTIVE', isActive: true, effectiveFrom: null, effectiveTo: null });
    await expect(service.update('k1', { code: 'NEW_CODE' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivates active KPI', async () => {
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'k1', companyId: 'c1', code: 'K1', status: 'ACTIVE', isActive: true });
    prisma.performanceKpiDefinition.update.mockResolvedValue({ id: 'k1', isActive: false, status: 'DEPRECATED' });
    const res = await service.deactivate('k1', ctx, 'u1');
    expect(res.status).toBe('DEPRECATED');
    expect(prisma.performanceKpiDefinition.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'k1' }, data: expect.objectContaining({ isActive: false, status: 'DEPRECATED' }) }));
  });
});
