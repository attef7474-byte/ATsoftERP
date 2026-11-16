import { printFormatters, PRINT_ROW_LIMIT, PrintPreparationError, type PrintColumn } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

interface WarehouseName { id: string; code?: string; name?: string }
interface RecentDocument { id: string; countNumber?: string; movementNumber?: string; adjustmentNumber?: string; warehouse?: WarehouseName | null; status: string; createdAt: string }
export interface InventoryOverviewPrintData {
  totalWarehouses: number; totalLocations: number; positiveBalanceProducts: number; zeroBalanceProducts: number; negativeBalanceProducts: number;
  openCounts: number; completedCounts: number; postedMovements: number; postedAdjustments: number;
  balancesByWarehouse: Array<{ warehouseId: string; totalQuantity: number | string; count: number }>;
  recentCounts: RecentDocument[]; recentMovements: RecentDocument[]; recentAdjustments: RecentDocument[];
}

/** Existing dashboard contract: row counts, never sums of unlike stock units. */
export function inventoryOverviewPrintModel(snapshot: ReportPrintSnapshot<InventoryOverviewPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data } = snapshot, fmt = printFormatters(locale);
  const recent = [data.recentCounts, data.recentMovements, data.recentAdjustments];
  if (data.balancesByWarehouse.length + recent.reduce((n, rows) => n + rows.length, 0) > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const warehouses = new Map<string, string>();
  for (const rows of recent) for (const row of rows) if (row.warehouse) warehouses.set(row.warehouse.id, row.warehouse.name || row.warehouse.code || '');
  const recentSection = (title: string, rows: RecentDocument[], number: 'countNumber' | 'movementNumber' | 'adjustmentNumber') => ({
    title: t(title), rows, columns: [
      { key: number, label: t('common.code'), value: row => row[number], align: 'start', priority: 1, width: 24, direction: 'ltr' },
      { key: 'warehouse', label: t('reports.warehouse'), value: row => row.warehouse?.name || row.warehouse?.code, align: 'start', priority: 1, width: 32 },
      { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 20 },
      { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 24, direction: 'ltr' },
    ] as PrintColumn<RecentDocument>[],
  });
  return {
    mode: 'REPORT', title: t('reports.inventoryOverview'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.inventoryOverviewScope'), filters: [],
    summary: [
      ['totalWarehouses', data.totalWarehouses], ['totalLocations', data.totalLocations],
      ['positiveBalance', data.positiveBalanceProducts], ['zeroBalance', data.zeroBalanceProducts], ['negativeBalance', data.negativeBalanceProducts],
      ['openCounts', data.openCounts], ['completedCounts', data.completedCounts], ['postedMovements', data.postedMovements], ['postedAdjustments', data.postedAdjustments],
    ].map(([label, value]) => ({ label: t(`reports.${label}`), value: fmt.number(value as number) })),
    sections: [
      { title: t('reports.balancesByWarehouse'), rows: data.balancesByWarehouse, columns: [
        { key: 'warehouse', label: t('reports.warehouse'), value: row => warehouses.get(row.warehouseId) || undefined, align: 'start', priority: 1, width: 70 },
        { key: 'count', label: t('reports.totalBalanceRows'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 30, direction: 'ltr' },
      ] },
      recentSection('reports.recentCounts', data.recentCounts, 'countNumber'),
      recentSection('reports.recentMovements', data.recentMovements, 'movementNumber'),
      recentSection('reports.recentAdjustments', data.recentAdjustments, 'adjustmentNumber'),
    ],
    notes: [t('reports.printDocument.inventoryOverviewNote'), t('reports.printDocument.inventoryMixedUnits'), ...(data.balancesByWarehouse.some(row => !warehouses.get(row.warehouseId)) ? [t('reports.printDocument.missingWarehouseNames')] : [])],
  };
}
