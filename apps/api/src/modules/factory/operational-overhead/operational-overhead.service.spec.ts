import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OperationalOverheadService } from './operational-overhead.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctxA: ActiveOperationalContext = {
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

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'c2:b2:-:-',
  companyId: 'c2',
  companyName: 'Company B',
  branchId: 'b2',
  branchName: 'HQ2',
};

const period = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'OH-2026-01',
  periodFrom: new Date('2026-01-01T00:00:00.000Z'),
  periodTo: new Date('2026-02-01T00:00:00.000Z'),
  status: 'DRAFT',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: 'u1',
  updatedById: 'u1',
  closedAt: null,
  closedById: null,
  deletedAt: null,
  ...overrides,
});

const activeCc = (overrides: Record<string, any> = {}) => ({
  id: 'cc1',
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  deletedAt: null,
  ...overrides,
});

const entry = (overrides: Record<string, any> = {}) => ({
  id: 'e1',
  companyId: 'c1',
  branchId: 'b1',
  periodId: 'p1',
  reference: 'REF-001',
  overheadCategory: 'UTILITIES',
  costPurpose: 'UTILITIES',
  description: 'Electricity',
  amount: new Prisma.Decimal('120.5000'),
  currencyCode: 'USD',
  incurredAt: new Date('2026-01-15T00:00:00.000Z'),
  sourceCostCenterId: 'cc1',
  status: 'DRAFT',
  finalizedAt: null,
  finalizedById: null,
  notes: null,
  externalDocumentReference: null,
  createdById: 'u1',
  updatedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('OperationalOverheadService', () => {
  let prisma: any;
  let audit: any;
  let service: OperationalOverheadService;

  beforeEach(() => {
    prisma = {
      operationalOverheadPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      operationalOverheadEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', operationalCurrencyCode: 'USD' }) },
      costCenter: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue(undefined), log: jest.fn().mockResolvedValue(undefined) };
    service = new OperationalOverheadService(prisma, audit);
  });

  const entryDto = {
    periodId: 'p1',
    reference: 'REF-001',
    overheadCategory: 'UTILITIES',
    costPurpose: 'UTILITIES',
    description: 'Electricity bill',
    amount: 120.5,
    incurredAt: '2026-01-15T00:00:00.000Z',
    sourceCostCenterId: 'cc1',
  };

  describe('createPeriod', () => {
    it('creates a DRAFT period scoped exclusively to the active tenant', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null); // open / overlap / code
      prisma.operationalOverheadPeriod.create.mockImplementation(({ data }: any) => Promise.resolve(period({ ...data })));

      const result = await service.createPeriod(
        { code: 'OH-2026-01', periodFrom: '2026-01-01T00:00:00.000Z', periodTo: '2026-02-01T00:00:00.000Z' },
        'u1',
        ctxA,
      );

      expect(prisma.operationalOverheadPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'DRAFT', createdById: 'u1' }),
        }),
      );
      expect(audit.logWithClient).toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });

    it('rejects a zero-length or inverted period range', async () => {
      await expect(
        service.createPeriod(
          { code: 'OH-X', periodFrom: '2026-02-01T00:00:00.000Z', periodTo: '2026-02-01T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createPeriod(
          { code: 'OH-X', periodFrom: '2026-03-01T00:00:00.000Z', periodTo: '2026-02-01T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an overlapping period within the same tenant (half-open overlap)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce(null); // open
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p9' }); // overlap
      await expect(
        service.createPeriod(
          { code: 'OH-2026-02', periodFrom: '2026-01-15T00:00:00.000Z', periodTo: '2026-02-15T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a duplicate code within the tenant (applock guards the race)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce(null); // open
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce(null); // overlap
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p9' }); // duplicate code
      await expect(
        service.createPeriod(
          { code: 'OH-2026-01', periodFrom: '2026-03-01T00:00:00.000Z', periodTo: '2026-04-01T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a second OPEN period (single OPEN window per tenant)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p99', status: 'OPEN' });
      await expect(
        service.createPeriod(
          { code: 'OH-2026-03', periodFrom: '2026-04-01T00:00:00.000Z', periodTo: '2026-05-01T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('acquires the PERIODS applock inside the transaction (concurrency gate)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      prisma.operationalOverheadPeriod.create.mockImplementation(({ data }: any) => Promise.resolve(period({ ...data })));
      await service.createPeriod(
        { code: 'OH-2026-01', periodFrom: '2026-01-01T00:00:00.000Z', periodTo: '2026-02-01T00:00:00.000Z' },
        'u1',
        ctxA,
      );
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('propagates an applock timeout / conflict as a conflict', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: -1 }]);
      await expect(
        service.createPeriod(
          { code: 'OH-2026-01', periodFrom: '2026-01-01T00:00:00.000Z', periodTo: '2026-02-01T00:00:00.000Z' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('find periods (tenant isolation)', () => {
    it('does not leak a period owned by another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.findOnePeriod('p1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.operationalOverheadPeriod.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'p1', companyId: 'c2', branchId: 'b2' }) }),
      );
    });

    it('scopes the list to the active company and branch, excluding deleted', async () => {
      prisma.operationalOverheadPeriod.findMany.mockResolvedValue([period()]);
      prisma.operationalOverheadPeriod.count.mockResolvedValue(1);
      const result = await service.findPeriods({ page: 1, limit: 20 }, ctxA);
      expect(prisma.operationalOverheadPeriod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  describe('openPeriod', () => {
    it('opens only a DRAFT period in the same tenant', async () => {
      prisma.operationalOverheadPeriod.findFirst
        .mockResolvedValueOnce(period({ status: 'DRAFT' })) // findPeriodScoped
        .mockResolvedValue(null); // existingOpen -> none
      prisma.operationalOverheadPeriod.update.mockImplementation(({ data }: any) => Promise.resolve(period({ ...data, status: 'OPEN' })));
      const result = await service.openPeriod('p1', { notes: 'go' }, 'u1', ctxA);
      expect(result.status).toBe('OPEN');
      expect(prisma.operationalOverheadPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'OPEN' }) }),
      );
    });

    it('rejects opening a non-DRAFT period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      await expect(service.openPeriod('p1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects opening when another OPEN period already exists', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce(period({ status: 'DRAFT' }));
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p8', status: 'OPEN' });
      await expect(service.openPeriod('p1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not open a period owned by another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.openPeriod('p1', {}, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('closePeriod', () => {
    it('closes only an OPEN period with all entries FINALIZED', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.count.mockResolvedValue(0);
      prisma.operationalOverheadPeriod.update.mockImplementation(({ data }: any) =>
        Promise.resolve(period({ ...data, status: 'CLOSED', closedAt: new Date(), closedById: 'u1' })),
      );
      const result = await service.closePeriod('p1', { reason: 'done' }, 'u1', ctxA);
      expect(result.status).toBe('CLOSED');
      expect(prisma.operationalOverheadPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED', closedById: 'u1' }) }),
      );
    });

    it('rejects closing a non-OPEN period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      await expect(service.closePeriod('p1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects closing a period with unfinished entries', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.count.mockResolvedValue(3);
      await expect(service.closePeriod('p1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not close a period owned by another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.closePeriod('p1', {}, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancelPeriod', () => {
    it('cancels only an empty DRAFT period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      prisma.operationalOverheadEntry.count.mockResolvedValue(0);
      prisma.operationalOverheadPeriod.update.mockImplementation(({ data }: any) => Promise.resolve(period({ ...data, status: 'CANCELLED' })));
      const result = await service.cancelPeriod('p1', 'u1', ctxA);
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancelling a non-DRAFT period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      await expect(service.cancelPeriod('p1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects cancelling a DRAFT period that already has entries', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      prisma.operationalOverheadEntry.count.mockResolvedValue(1);
      await expect(service.cancelPeriod('p1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not cancel a period owned by another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.cancelPeriod('p1', 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updatePeriod', () => {
    it('rejects updating a CLOSED (immutable) period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
      await expect(service.updatePeriod('p1', { code: 'OH-NEW' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a duplicate code on update (code change acquires the lock)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p9' }); // duplicate code
      await expect(service.updatePeriod('p1', { code: 'OH-DUP' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an overlapping range change', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValueOnce({ id: 'p9' }); // overlap in update
      await expect(
        service.updatePeriod('p1', { periodFrom: '2026-01-15T00:00:00.000Z', periodTo: '2026-03-01T00:00:00.000Z' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates an editable period and preserves tenant scope', async () => {
      prisma.operationalOverheadPeriod.findFirst
        .mockResolvedValueOnce(period({ status: 'OPEN' })) // findPeriodScoped
        .mockResolvedValue(null); // duplicate code -> none
      prisma.operationalOverheadPeriod.update.mockImplementation(({ data }: any) => Promise.resolve(period({ ...data, status: 'OPEN' })));
      const result = await service.updatePeriod('p1', { code: 'OH-UPDATED' }, 'u1', ctxA);
      expect(result).toBeTruthy();
      expect(prisma.operationalOverheadPeriod.update).toHaveBeenCalled();
    });

    it('does not update a period owned by another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.updatePeriod('p1', { code: 'X' }, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createEntry', () => {
    it('creates a DRAFT entry in an OPEN period, scoped to the tenant, currency from company', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null); // duplicate ref
      prisma.costCenter.findFirst.mockResolvedValue(activeCc());
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', operationalCurrencyCode: 'USD' });
      prisma.operationalOverheadEntry.create.mockImplementation(({ data }: any) => Promise.resolve(entry({ ...data })));

      const result = await service.createEntry(entryDto, 'u1', ctxA);

      expect(prisma.operationalOverheadEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            periodId: 'p1',
            currencyCode: 'USD',
            status: 'DRAFT',
            amount: expect.any(Prisma.Decimal),
          }),
        }),
      );
      expect(result.status).toBe('DRAFT');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects an invalid overhead category', async () => {
      await expect(
        service.createEntry({ ...entryDto, overheadCategory: 'MATERIAL' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid cost purpose', async () => {
      await expect(
        service.createEntry({ ...entryDto, costPurpose: 'BOGUS' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an entry into a non-OPEN period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'DRAFT' }));
      await expect(service.createEntry(entryDto, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an entry whose incurredAt falls outside the half-open period', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.createEntry({ ...entryDto, incurredAt: '2026-03-01T00:00:00.000Z' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate reference within the same period (applock guards the race)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue({ id: 'e9' });
      await expect(service.createEntry(entryDto, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a source cost center from another company (tenant isolation)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      prisma.costCenter.findFirst.mockResolvedValue(activeCc({ companyId: 'c2' }));
      await expect(service.createEntry(entryDto, 'u1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an entry whose period belongs to another company (404)', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(null);
      await expect(service.createEntry(entryDto, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a deleted / inactive source cost center', async () => {
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      prisma.costCenter.findFirst.mockResolvedValue(activeCc({ status: 'INACTIVE' }));
      await expect(service.createEntry(entryDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('find entries (tenant isolation)', () => {
    it('does not leak an entry owned by another company (404)', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      await expect(service.findOneEntry('e1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.operationalOverheadEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'e1', companyId: 'c2', branchId: 'b2' }) }),
      );
    });

    it('scopes the entry list to the tenant and excludes deleted', async () => {
      prisma.operationalOverheadEntry.findMany.mockResolvedValue([entry()]);
      prisma.operationalOverheadEntry.count.mockResolvedValue(1);
      const result = await service.findEntries({ page: 1, limit: 20 }, ctxA);
      expect(prisma.operationalOverheadEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  describe('updateEntry', () => {
    it('rejects updating a FINALIZED entry', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry({ status: 'FINALIZED' }));
      await expect(service.updateEntry('e1', { description: 'x' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a duplicate reference on update (code change acquires the lock)', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.findFirst.mockResolvedValueOnce({ id: 'e9' }); // duplicate ref
      await expect(service.updateEntry('e1', { reference: 'REF-DUP' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an update when the period is not OPEN', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
      await expect(service.updateEntry('e1', { description: 'x' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an out-of-period incurredAt on update', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      await expect(
        service.updateEntry('e1', { incurredAt: '2026-05-01T00:00:00.000Z' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a DRAFT entry with tenant scope preserved', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.update.mockImplementation(({ data }: any) => Promise.resolve(entry({ ...data })));
      const result = await service.updateEntry('e1', { description: 'Updated description' }, 'u1', ctxA);
      expect(result).toBeTruthy();
      expect(prisma.operationalOverheadEntry.update).toHaveBeenCalled();
    });

    it('does not update an entry owned by another company (404)', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      await expect(service.updateEntry('e1', { description: 'x' }, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('finalizeEntry', () => {
    it('finalizes only a DRAFT entry in an OPEN period with matching currency', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', operationalCurrencyCode: 'USD' });
      prisma.operationalOverheadEntry.update.mockImplementation(({ data }: any) =>
        Promise.resolve(entry({ ...data, status: 'FINALIZED', finalizedAt: new Date(), finalizedById: 'u1' })),
      );
      const result = await service.finalizeEntry('e1', {}, 'u1', ctxA);
      expect(result.status).toBe('FINALIZED');
    });

    it('rejects finalizing an already-FINALIZED entry', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry({ status: 'FINALIZED' }));
      await expect(service.finalizeEntry('e1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects finalizing an entry when the company currency differs from source currency', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', operationalCurrencyCode: 'EUR' });
      await expect(service.finalizeEntry('e1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects finalizing when the period is not OPEN', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
      await expect(service.finalizeEntry('e1', {}, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not finalize an entry owned by another company (404)', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      await expect(service.finalizeEntry('e1', {}, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteEntry', () => {
    it('soft deletes only a DRAFT entry in an unclosed period', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'OPEN' }));
      prisma.operationalOverheadEntry.update.mockImplementation(({ data }: any) => Promise.resolve(entry({ ...data, deletedAt: new Date() })));
      const result = await service.deleteEntry('e1', 'u1', ctxA);
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(prisma.operationalOverheadEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('rejects deleting a FINALIZED entry', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry({ status: 'FINALIZED' }));
      await expect(service.deleteEntry('e1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects deleting an entry in a CLOSED period', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(entry());
      prisma.operationalOverheadPeriod.findFirst.mockResolvedValue(period({ status: 'CLOSED' }));
      await expect(service.deleteEntry('e1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not delete an entry owned by another company (404)', async () => {
      prisma.operationalOverheadEntry.findFirst.mockResolvedValue(null);
      await expect(service.deleteEntry('e1', 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
