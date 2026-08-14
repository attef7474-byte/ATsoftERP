import { NotFoundException } from '@nestjs/common';
import { BarcodeScansService } from './barcode-scans.service';
import { BarcodeLabelsService } from './barcode-labels.service';

describe('BarcodeScansService tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
  let prisma: any;
  let labelsService: any;
  let audit: any;
  let service: BarcodeScansService;

  beforeEach(() => {
    prisma = {
      barcodeScanEvent: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      barcodeLabel: { update: jest.fn() },
      inventoryCount: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      inventoryCountLine: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      machinePart: { findFirst: jest.fn() },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequest: { count: jest.fn().mockResolvedValue(0) },
      maintenanceTask: { count: jest.fn().mockResolvedValue(0) },
      downtimeLog: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { durationMinutes: null } }),
      },
    };
    labelsService = { resolve: jest.fn() } as any;
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new BarcodeScansService(prisma, audit, labelsService);
  });

  afterEach(() => jest.restoreAllMocks());

  const resolvedLabel = (overrides: any = {}) => ({
    id: 'label-a',
    code: 'M-001',
    value: 'AT-MACHINE-001',
    status: 'ACTIVE',
    title: 'Machine A',
    symbology: 'QR_CODE',
    entityType: 'MACHINE',
    entityId: 'machine-a',
    ...overrides,
  });

  const eventRow = (overrides: any = {}) => ({
    id: 'event-a',
    scannedAt: new Date('2026-01-01T00:00:00Z'),
    companyId: 'company-a',
    branchId: 'branch-a',
    ...overrides,
  });

  describe('scan creation', () => {
    it('persists ctx company and branch on a successful scan and never trusts the client', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel(), entity: { type: 'MACHINE', id: 'machine-a' } });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      const dto = { value: 'AT-MACHINE-001', source: 'WEB' } as any;
      await service.scan(dto, ctx, 'user-a');

      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-a',
          branchId: 'branch-a',
          scannedValue: 'AT-MACHINE-001',
          scannedById: 'user-a',
        }),
      });
    });

    it('records ownership even when no label resolves', async () => {
      labelsService.resolve.mockResolvedValue({ found: false, result: 'NOT_FOUND', label: null, entity: null });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scan({ value: 'UNKNOWN' } as any, ctx);

      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', result: 'NOT_FOUND' }),
      });
    });

    it('never allows a client-provided tenant id to override the active context', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel(), entity: { type: 'MACHINE', id: 'machine-a' } });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      const dto = { value: 'AT-MACHINE-001', companyId: 'evil-company', branchId: 'evil-branch' } as any;
      await service.scan(dto, ctx, 'user-a');

      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      });
    });
  });

  describe('resolve validation', () => {
    it('rejects a foreign label through resolve (label outside active context)', async () => {
      labelsService.resolve.mockResolvedValue({ found: false, result: 'NOT_FOUND', label: null, entity: null });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      const result = await service.scan({ value: 'AT-MACHINE-002' } as any, ctx, 'user-a');

      expect(labelsService.resolve).toHaveBeenCalledWith('AT-MACHINE-002', ctx);
      expect(result.result).toBe('NOT_FOUND');
      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', result: 'NOT_FOUND' }),
      });
    });

    it('does not perform a tenant write when the label is foreign', async () => {
      labelsService.resolve.mockResolvedValue({ found: false, result: 'NOT_FOUND', label: null, entity: null });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scan({ value: 'FOREIGN' } as any, ctx, 'user-a');

      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.barcodeLabel.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllScans', () => {
    it('scopes list queries to the active company and branch at the database level', async () => {
      prisma.barcodeScanEvent.findMany.mockResolvedValue([]);
      prisma.barcodeScanEvent.count.mockResolvedValue(0);

      await service.findAllScans({ page: 1, limit: 10 } as any, ctx);

      expect(prisma.barcodeScanEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      }));
      expect(prisma.barcodeScanEvent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      });
    });
  });

  describe('findScanById', () => {
    it('returns a same-tenant scan event', async () => {
      prisma.barcodeScanEvent.findFirst.mockResolvedValue(eventRow());
      const scan = await service.findScanById('event-a', ctx);
      expect(prisma.barcodeScanEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'event-a', companyId: 'company-a', branchId: 'branch-a' },
      }));
      expect(scan.id).toBe('event-a');
    });

    it('treats a foreign-company event as invisible (NotFoundException)', async () => {
      prisma.barcodeScanEvent.findFirst.mockResolvedValue(null);
      await expect(service.findScanById('foreign-event', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.barcodeScanEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-event', companyId: 'company-a', branchId: 'branch-a' },
      }));
    });

    it('treats a same-company foreign-branch event as invisible (NotFoundException)', async () => {
      prisma.barcodeScanEvent.findFirst.mockResolvedValue(null);
      await expect(service.findScanById('branch-b-event', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.barcodeScanEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'branch-b-event', companyId: 'company-a', branchId: 'branch-a' },
      }));
    });

    it('never exposes a legacy event with NULL tenant ownership', async () => {
      prisma.barcodeScanEvent.findFirst.mockResolvedValue(null);
      await expect(service.findScanById('legacy-null-event', ctx)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.barcodeScanEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'legacy-null-event', companyId: 'company-a', branchId: 'branch-a' },
      }));
    });
  });

  describe('getScanSummary', () => {
    it('scopes all summary counts to the active company and branch', async () => {
      prisma.barcodeScanEvent.count.mockResolvedValue(5);
      prisma.barcodeScanEvent.groupBy.mockResolvedValue([{ result: 'SUCCESS', _count: 5 }]);

      const summary = await service.getScanSummary(ctx);

      expect(prisma.barcodeScanEvent.count).toHaveBeenCalledTimes(4);
      expect(prisma.barcodeScanEvent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      });
      expect(prisma.barcodeScanEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      }));
      expect(summary.totalScans).toBe(5);
    });
  });

  describe('findScansByEntity', () => {
    it('scopes entity scan reads to the active company and branch', async () => {
      prisma.barcodeScanEvent.findMany.mockResolvedValue([]);
      prisma.barcodeScanEvent.count.mockResolvedValue(0);

      await service.findScansByEntity('MACHINE', 'machine-a', { page: 1, limit: 10 } as any, ctx);

      expect(prisma.barcodeScanEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', entityType: 'MACHINE', entityId: 'machine-a' }),
      }));
    });
  });

  describe('scanInventoryCount', () => {
    it('rejects an inventory count outside the active context before any line write', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityType: 'PRODUCT', entityId: 'product-a' }), entity: { type: 'PRODUCT', id: 'product-a' } });
      prisma.inventoryCount.findFirst.mockResolvedValue(null);

      await expect(
        service.scanInventoryCount({ value: 'AT-PRODUCT-001', inventoryCountId: 'foreign-count', countedQty: 5 } as any, ctx, 'user-a'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.inventoryCount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-count', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
      expect(prisma.inventoryCountLine.create).not.toHaveBeenCalled();
      expect(prisma.inventoryCountLine.update).not.toHaveBeenCalled();
    });

    it('writes count lines only under a same-tenant count', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityType: 'PRODUCT', entityId: 'product-a' }), entity: { type: 'PRODUCT', id: 'product-a' } });
      prisma.inventoryCount.findFirst.mockResolvedValue({ id: 'count-a', status: 'IN_PROGRESS' });
      prisma.product.findFirst.mockResolvedValue({ id: 'product-a', code: 'P1', name: 'Part', unit: 'EA' });
      prisma.inventoryCountLine.findFirst.mockResolvedValue(null);
      prisma.inventoryCountLine.create.mockResolvedValue({ id: 'line-a', systemQty: 0, countedQty: 5, differenceQty: -5, status: 'COUNTED' });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scanInventoryCount({ value: 'AT-PRODUCT-001', inventoryCountId: 'count-a', countedQty: 5 } as any, ctx, 'user-a');

      expect(prisma.inventoryCount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'count-a', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
      expect(prisma.inventoryCountLine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ countId: 'count-a', productId: 'product-a' }),
        include: { product: true },
      });
      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      });
    });
  });

  describe('scanPartLookup', () => {
    it('scopes machine-part balance reads to the active company and branch warehouses', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityType: 'MACHINE_PART', entityId: 'part-a' }), entity: { type: 'MACHINE_PART', id: 'part-a' } });
      prisma.machinePart.findFirst.mockResolvedValue({ id: 'part-a', productId: 'product-a' });
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scanPartLookup({ value: 'AT-MACHINE-PART-001' } as any, ctx, 'user-a');

      expect(prisma.machinePart.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'part-a', machine: expect.objectContaining({ companyId: 'company-a' }) }),
      }));
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ productId: 'product-a', warehouse: expect.objectContaining({ companyId: 'company-a' }) }),
      }));
    });

    it('does not expose balances for a foreign machine part', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityType: 'MACHINE_PART', entityId: 'foreign-part' }), entity: { type: 'MACHINE_PART', id: 'foreign-part' } });
      prisma.machinePart.findFirst.mockResolvedValue(null);
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scanPartLookup({ value: 'AT-MACHINE-PART-002' } as any, ctx, 'user-a');

      expect(prisma.inventoryBalance.findMany).not.toHaveBeenCalled();
    });
  });

  describe('scanMachineCheck', () => {
    it('scopes machine check counters to the machine resolved within the active context', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel(), entity: { type: 'MACHINE', id: 'machine-a' } });
      prisma.maintenanceRequest.count.mockResolvedValue(2);
      prisma.maintenanceTask.count.mockResolvedValue(1);
      prisma.downtimeLog.count.mockResolvedValue(1);
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      const result = await service.scanMachineCheck({ value: 'AT-MACHINE-001' } as any, ctx, 'user-a');

      expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          machineId: 'machine-a',
          machine: expect.objectContaining({ companyId: 'company-a' }),
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          deletedAt: null,
        },
      }));
      expect(result.operationalSummary).toEqual({ activeRequests: 2, openTasks: 1, activeDowntime: 1, totalDowntimeHoursThisMonth: 0 });
      expect(prisma.barcodeScanEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      });
    });

    it('defense in depth: every machine check aggregate carries tenant-compatible machine scope even if machineId bypasses an earlier helper', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityId: 'foreign-machine' }), entity: { type: 'MACHINE', id: 'foreign-machine' } });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scanMachineCheck({ value: 'AT-MACHINE-999' } as any, ctx, 'user-a');

      const expectedMachineScope = expect.objectContaining({
        companyId: 'company-a',
        OR: [{ branchId: 'branch-a' }, { branchId: null }],
        deletedAt: null,
      });
      expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machineId: 'foreign-machine', machine: expectedMachineScope }),
      }));
      expect(prisma.maintenanceTask.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ request: expect.objectContaining({ machineId: 'foreign-machine', machine: expectedMachineScope }) }),
      }));
      expect(prisma.downtimeLog.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machineId: 'foreign-machine', machine: expectedMachineScope }),
      }));
      expect(prisma.downtimeLog.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machineId: 'foreign-machine', machine: expectedMachineScope }),
      }));
    });

    it('defense in depth: a company-wide machine (branchId null) remains countable under the accepted machine ownership contract', async () => {
      labelsService.resolve.mockResolvedValue({ found: true, result: 'SUCCESS', label: resolvedLabel({ entityId: 'company-machine' }), entity: { type: 'MACHINE', id: 'company-machine' } });
      prisma.barcodeScanEvent.create.mockResolvedValue(eventRow());

      await service.scanMachineCheck({ value: 'AT-MACHINE-777' } as any, ctx, 'user-a');

      expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machine: expect.objectContaining({ OR: [{ branchId: 'branch-a' }, { branchId: null }] }) }),
      }));
    });
  });
});
