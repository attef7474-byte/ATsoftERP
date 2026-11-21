import { ValidationPipe } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExportReportQueryDto } from '../dto/report-filter.dto';
import { ReportsController } from '../reports.controller';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { EXPORT_ROW_LIMIT, ReportExportService } from './report-export.service';
import { paginate, REPORT_MAX_PAGE_SIZE } from './report-query-utils';

const ctx = {
  contextKey: 'ctx-1',
  scopeId: null,
  companyId: 'company-a',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'branch-a',
  branchName: 'Branch A',
  branchCode: 'BA',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
} as ActiveOperationalContext;

const defaultData = { rows: [{ id: 'row-1' }] };

function mockService(names: string[], data: any = defaultData): Record<string, jest.Mock> {
  return Object.fromEntries(names.map((name) => [name, jest.fn().mockResolvedValue(data)]));
}

function buildHarness() {
  const dashboard = mockService(['getMaintenanceOverview', 'getInventoryOverview']);
  const maintenance = mockService([
    'getMaintenanceRequestsReport',
    'getMachineDowntimeReport',
    'getMaintenanceCostsReport',
    'maintenanceCanonicalCosts',
    'getPreventiveSchedulesReport',
    'getCostAnalysis',
    'getCostByMachine',
    'getScheduleCompliance',
    'getKpiOverview',
    'getBacklogTrend',
    'getMachineLogReport',
    'getPartsUsageReport',
    'getUpcomingPreventiveReport',
    'getOverduePreventiveReport',
  ]);
  const inventory = mockService([
    'getInventoryBalanceReport',
    'getInventoryCountVarianceReport',
    'getInventoryMovementsReport',
    'getInventoryAdjustmentsReport',
    'getStockCard',
    'getMovementTypes',
    'getByWarehouseSummary',
    'getByLocationSummary',
    'getByProduct',
    'getBySource',
    'getMovementTraceability',
    'getExceptions',
    'getTopMovingItems',
    'getDashboardCards',
    'getNegativeBalances',
    'getReconciliationDifferences',
  ]);
  const barcode = mockService(['getBarcodeScansReport']);
  const system = mockService([
    'getAssetsRegisterReport',
    'getPartsReport',
    'getPartnersReport',
    'getAttachmentsReport',
    'getLowStockReport',
  ]);
  const auditReports = mockService([
    'getAuditTrailReport',
    'getUserActivityReport',
    'getNotificationsReport',
  ]);
  const operations = mockService(['overview']);
  const analytics = mockService(['oee']);
  const audit = { log: jest.fn().mockResolvedValue({}) };

  const service = new ReportExportService(
    dashboard as any,
    maintenance as any,
    inventory as any,
    barcode as any,
    system as any,
    auditReports as any,
    operations as any,
    analytics as any,
    audit as any,
  );
  return { service, dashboard, maintenance, inventory, barcode, system, auditReports, operations, analytics, audit };
}

/** Every canonical report export endpoint and the service method it must use. */
const endpointToMethod: Record<string, [keyof ReturnType<typeof buildHarness>, string]> = {
  // maintenance (11)
  'maintenance/overview': ['dashboard', 'getMaintenanceOverview'],
  'maintenance/requests': ['maintenance', 'getMaintenanceRequestsReport'],
  'maintenance/downtime': ['maintenance', 'getMachineDowntimeReport'],
  'maintenance/costs': ['maintenance', 'getMaintenanceCostsReport'],
  'maintenance/costs/canonical': ['maintenance', 'maintenanceCanonicalCosts'],
  'maintenance/schedules': ['maintenance', 'getPreventiveSchedulesReport'],
  'maintenance/costs/analysis': ['maintenance', 'getCostAnalysis'],
  'maintenance/costs/by-machine': ['maintenance', 'getCostByMachine'],
  'maintenance/schedule-compliance': ['maintenance', 'getScheduleCompliance'],
  'maintenance/kpi-overview': ['maintenance', 'getKpiOverview'],
  'maintenance/backlog-trend': ['maintenance', 'getBacklogTrend'],
  // inventory overview + core (5)
  'inventory/overview': ['dashboard', 'getInventoryOverview'],
  'inventory/balances': ['inventory', 'getInventoryBalanceReport'],
  'inventory/count-variance': ['inventory', 'getInventoryCountVarianceReport'],
  'inventory/movements': ['inventory', 'getInventoryMovementsReport'],
  'inventory/adjustments': ['inventory', 'getInventoryAdjustmentsReport'],
  // inventory traceability batch (12)
  'inventory/stock-card': ['inventory', 'getStockCard'],
  'inventory/movement-types': ['inventory', 'getMovementTypes'],
  'inventory/by-warehouse': ['inventory', 'getByWarehouseSummary'],
  'inventory/by-location': ['inventory', 'getByLocationSummary'],
  'inventory/by-product/PROD': ['inventory', 'getByProduct'],
  'inventory/by-source/TYPE/SRC': ['inventory', 'getBySource'],
  'inventory/traceability/MOV': ['inventory', 'getMovementTraceability'],
  'inventory/exceptions': ['inventory', 'getExceptions'],
  'inventory/top-moving-items': ['inventory', 'getTopMovingItems'],
  'inventory/dashboard-cards': ['inventory', 'getDashboardCards'],
  'inventory/negative-balances': ['inventory', 'getNegativeBalances'],
  'inventory/reconciliation-differences': ['inventory', 'getReconciliationDifferences'],
  // barcode (1)
  'barcodes/scans': ['barcode', 'getBarcodeScansReport'],
  // assets / system / audit (7)
  assets: ['system', 'getAssetsRegisterReport'],
  parts: ['system', 'getPartsReport'],
  partners: ['system', 'getPartnersReport'],
  attachments: ['system', 'getAttachmentsReport'],
  audit: ['auditReports', 'getAuditTrailReport'],
  'user-activity': ['auditReports', 'getUserActivityReport'],
  notifications: ['auditReports', 'getNotificationsReport'],
  // corrective (5)
  'machine-log': ['maintenance', 'getMachineLogReport'],
  'parts-usage': ['maintenance', 'getPartsUsageReport'],
  'upcoming-preventive': ['maintenance', 'getUpcomingPreventiveReport'],
  'overdue-preventive': ['maintenance', 'getOverduePreventiveReport'],
  'low-stock': ['system', 'getLowStockReport'],
  // Phase 6 additional audited XLSX endpoints (2)
  'operations/overview': ['operations', 'overview'],
  'production/analytics': ['analytics', 'oee'],
};

describe('ReportExportService', () => {
  describe('endpoint coverage', () => {
    it('maps all 43 canonical report endpoints to existing service methods', async () => {
      expect(Object.keys(endpointToMethod)).toHaveLength(43);
      for (const [endpoint, [serviceKey, method]] of Object.entries(endpointToMethod)) {
        const harness = buildHarness();
        const csv = await harness.service.exportCsv(endpoint, {}, ctx, 'actor-1');
        expect(csv).toContain('row-1');
        expect((harness[serviceKey] as any)[method]).toHaveBeenCalledTimes(1);
      }
    });

    it('extracts path parameters for the dynamic inventory endpoints', async () => {
      const h = buildHarness();
      await h.service.exportCsv('inventory/by-product/PROD', {}, ctx, 'a');
      expect(h.inventory.getByProduct).toHaveBeenCalledWith('PROD', expect.any(Object), ctx);

      await h.service.exportCsv('inventory/by-source/TYPE/SRC', {}, ctx, 'a');
      expect(h.inventory.getBySource).toHaveBeenCalledWith('TYPE', 'SRC', ctx);

      await h.service.exportCsv('inventory/traceability/MOV', {}, ctx, 'a');
      expect(h.inventory.getMovementTraceability).toHaveBeenCalledWith('MOV', ctx);
    });

    it('returns empty output and audits nothing for an unknown endpoint', async () => {
      const h = buildHarness();
      expect(await h.service.exportCsv('not/a/report', {}, ctx, 'a')).toBe('');
      expect(await h.service.exportExcel('not/a/report', {}, ctx, 'a')).toBeNull();
      expect(h.audit.log).not.toHaveBeenCalled();
    });
  });

  describe('tenant authority and query sanitisation', () => {
    it('strips client companyId/branchId and forces a full-dataset page', async () => {
      const h = buildHarness();
      await h.service.exportCsv(
        'maintenance/requests',
        { companyId: 'foreign', branchId: 'foreign', machineId: 'machine-1' },
        ctx,
        'a',
      );
      const call = h.maintenance.getMaintenanceRequestsReport.mock.calls[0];
      const filters = call[0];
      expect(call[1]).toBe(ctx);
      expect(filters).not.toHaveProperty('companyId');
      expect(filters).not.toHaveProperty('branchId');
      expect(filters.machineId).toBe('machine-1');
      expect(filters.page).toBe(1);
      expect(filters.pageSize).toBe(EXPORT_ROW_LIMIT + 1);
    });

    it('rejects client tenant fields through the strict export DTO whitelist', async () => {
      const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
      const validate = (value: any) => pipe.transform(value, { type: 'query', metatype: ExportReportQueryDto });
      await expect(validate({ companyId: 'foreign' })).rejects.toBeDefined();
      await expect(validate({ branchId: 'foreign' })).rejects.toBeDefined();
      await expect(validate({ machineId: 'machine-1', pageSize: '20' })).resolves.toEqual(
        expect.objectContaining({ machineId: 'machine-1', pageSize: 20 }),
      );
    });
  });

  describe('summary-shaped responses', () => {
    it('exports a Summary sheet with KPI rows when the endpoint has no rows', async () => {
      const h = buildHarness();
      h.inventory.getDashboardCards.mockResolvedValue({
        cards: [
          { label: 'totalProducts', value: 7 },
          { label: 'negativeBalances', value: 2, unit: 'items' },
        ],
      });
      const csv = await h.service.exportCsv('inventory/dashboard-cards', {}, ctx, 'a');
      expect(csv).toContain('"Section","Field","Value"');
      expect(csv).toContain('"KPI","totalProducts","7"');
      expect(csv).toContain('"KPI","negativeBalances","2 items"');
    });

    it('flattens canonical cost summary groups instead of returning no data', async () => {
      const h = buildHarness();
      h.maintenance.maintenanceCanonicalCosts.mockResolvedValue({
        source: 'OPERATIONAL_COST_LEDGER',
        netCost: '12.50',
        byEventType: [{ key: 'ISSUE', netAmount: '12.50', entryCount: 1 }],
      });
      const csv = await h.service.exportCsv('maintenance/costs/canonical', {}, ctx, 'a');
      expect(csv).toContain('"Section","Field","Value"');
      expect(csv).toContain('"Summary","Net Cost","12.50"');
      expect(csv).toContain('By Event Type');
    });

    it('writes an Excel workbook named Summary for summary-shaped data', async () => {
      const h = buildHarness();
      h.inventory.getDashboardCards.mockResolvedValue({ cards: [{ label: 'totalProducts', value: 7 }] });
      const buffer = await h.service.exportExcel('inventory/dashboard-cards', {}, ctx, 'a');
      expect(buffer).not.toBeNull();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      expect(workbook.worksheets[0].name).toBe('Summary');
      expect(workbook.worksheets[0].getCell('A1').value).toBe('Section');
    });
  });

  describe('headers, row cap and CSV safety', () => {
    it('produces stable readable headers from the union of row keys and hides internal keys', async () => {
      const h = buildHarness();
      h.inventory.getInventoryBalanceReport.mockResolvedValue({
        rows: [
          { id: '1', movementNumber: 'MV-1', netAmount: 5, _type: 'cost' },
          { id: '2', extraField: true },
        ],
      });
      const csv = await h.service.exportCsv('inventory/balances', {}, ctx, 'a');
      expect(csv.startsWith('\uFEFF"Id","Movement Number","Net Amount","Extra Field"')).toBe(true);
      expect(csv).not.toContain('_type');
      expect(csv).toContain('"MV-1"');
    });

    it('guards formula injection and neutralises tabs and CR/LF', async () => {
      const h = buildHarness();
      h.inventory.getInventoryBalanceReport.mockResolvedValue({
        rows: [{ id: '1', formula: '=SUM(1+1)', plus: '+cmd', minus: '-cmd', at: '@SUM', tab: 'a\tb', cr: 'a\r\nb' }],
      });
      const csv = await h.service.exportCsv('inventory/balances', {}, ctx, 'a');
      const cell = (value: string) => `"${value}"`;
      expect(csv).toContain(cell("'=SUM(1+1)"));
      expect(csv).toContain(cell("'+cmd"));
      expect(csv).toContain(cell("'-cmd"));
      expect(csv).toContain(cell("'@SUM"));
      expect(csv).toContain(cell('a b'));
      expect(csv).not.toContain('\t');
      expect(csv).not.toContain('\r');
    });

    it('caps exports at 5000 rows and records the truncation flag', async () => {
      const h = buildHarness();
      const rows = Array.from({ length: EXPORT_ROW_LIMIT + 2 }, (_, index) => ({ id: `r${index}` }));
      h.inventory.getInventoryBalanceReport.mockResolvedValue({ rows });
      const csv = await h.service.exportCsv('inventory/balances', {}, ctx, 'actor-cap');
      const dataLines = csv.replace(/^\uFEFF/, '').split('\n').slice(1);
      expect(dataLines).toHaveLength(EXPORT_ROW_LIMIT);
      expect(h.inventory.getInventoryBalanceReport.mock.calls[0][0].pageSize).toBe(EXPORT_ROW_LIMIT + 1);
      const details = JSON.parse(h.audit.log.mock.calls[0][0].details);
      expect(details.rowCount).toBe(EXPORT_ROW_LIMIT);
      expect(details.truncated).toBe(true);
    });
  });

  describe('audit events', () => {
    it('audits a successful CSV export with endpoint, actor, scope and row count', async () => {
      const h = buildHarness();
      await h.service.exportCsv('maintenance/requests', {}, ctx, 'actor-7');
      expect(h.audit.log).toHaveBeenCalledTimes(1);
      const arg = h.audit.log.mock.calls[0][0];
      expect(arg).toEqual(
        expect.objectContaining({
          userId: 'actor-7',
          action: 'EXPORT',
          entity: 'report',
          entityId: 'maintenance/requests',
        }),
      );
      expect(JSON.parse(arg.details)).toEqual(
        expect.objectContaining({
          endpoint: 'maintenance/requests',
          actor: 'actor-7',
          companyId: 'company-a',
          branchId: 'branch-a',
          format: 'csv',
          rowCount: 1,
          truncated: false,
        }),
      );
    });

    it('audits a successful XLSX export and returns a real workbook', async () => {
      const h = buildHarness();
      const buffer = await h.service.exportExcel('maintenance/requests', {}, ctx, 'actor-8');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      expect(workbook.worksheets[0].name).toBe('Report');
      expect(workbook.worksheets[0].getCell('A1').value).toBe('Id');
      const arg = h.audit.log.mock.calls[0][0];
      expect(JSON.parse(arg.details)).toEqual(expect.objectContaining({ format: 'xlsx', actor: 'actor-8', rowCount: 1 }));
    });
  });

  describe('controller contract', () => {
    it('preserves the existing OR permission set on both export endpoints', () => {
      const expected = ['reports.maintenance:read', 'reports.inventory:read', 'reports.barcodes:read'];
      expect(Reflect.getMetadata('permissions', ReportsController.prototype.exportCsv)).toEqual(expected);
      expect(Reflect.getMetadata('permissions', ReportsController.prototype.exportExcel)).toEqual(expected);
    });
  });

  describe('paginate bounds', () => {
    it('paginates normally within bounds', () => {
      expect(paginate(3, 20)).toEqual({ skip: 40, take: 20 });
      expect(paginate(0, 0)).toEqual({ skip: 0, take: 20 });
      expect(paginate(1.9, 20.9)).toEqual({ skip: 0, take: 20 });
    });

    it('clamps excessive page sizes to the hard ceiling', () => {
      expect(paginate(1, 999999)).toEqual({ skip: 0, take: REPORT_MAX_PAGE_SIZE });
      expect(REPORT_MAX_PAGE_SIZE).toBeGreaterThan(EXPORT_ROW_LIMIT);
    });
  });
});
