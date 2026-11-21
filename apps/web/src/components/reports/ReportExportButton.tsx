'use client';
import React, { useState } from 'react';
import { Button } from '../admin/ui';
import { api } from '../../lib/api';
import { useApiErrorHandler } from '../admin/error-handler';
import { useToast } from '../admin/toast-provider';
import { useTranslation } from '../../lib/i18n/use-translation';

interface ReportExportButtonProps {
  filename?: string;
  headers: string[];
  rows: Record<string, any>[];
  mapRow: (row: Record<string, any>) => string[];
  onPrint?: () => void | Promise<void>;
  printDisabled?: boolean;
  reportEndpoint?: string;
  /** Render only the canonical server-side XLSX action (no client-side CSV/PDF). */
  xlsxOnly?: boolean;
}

const REPORT_LABEL_KEYS: Record<string, string> = {
  'maintenance/requests': 'reports.requestsReport',
  'maintenance/downtime': 'reports.downtimeReport',
  'maintenance/costs': 'reports.costsReport',
  'maintenance/schedules': 'reports.schedulesReport',
  'inventory/balances': 'reports.balancesReport',
  'inventory/count-variance': 'reports.countVarianceReport',
  'inventory/movements': 'reports.movementsReport',
  'inventory/adjustments': 'reports.adjustmentsReport',
  'barcodes/scans': 'reports.barcodeScansReport',
  assets: 'reports.assetsReport',
  parts: 'reports.partsReport',
  partners: 'reports.partnersReport',
  attachments: 'reports.attachmentsReport',
  audit: 'reports.auditTrailReport',
  'user-activity': 'reports.userActivityReport',
  notifications: 'reports.notificationsReport',
  'machine-log': 'reports.machineLogReport',
  'parts-usage': 'reports.partsUsageReport',
  'upcoming-preventive': 'reports.upcomingPreventiveReport',
  'overdue-preventive': 'reports.overduePreventiveReport',
  'low-stock': 'reports.lowStockReport',
  'operations/overview': 'operationsReports.title',
  'maintenance/overview': 'reports.maintenanceOverview',
  'maintenance/kpi-overview': 'maintenance.kpiOverview',
  'inventory/overview': 'reports.inventoryOverview',
  'production/analytics': 'production.analyticsWorkspace',
};

function safeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || 'report';
}

export function ReportExportButton({ filename = 'report', headers, rows, mapRow, onPrint, printDisabled, reportEndpoint, xlsxOnly }: ReportExportButtonProps) {
  const { t } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const { showToast } = useToast();
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const handleExportCsv = () => {
    const csvContent = [
      headers.join(','),
      ...rows.map(r => mapRow(r).map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    if (!reportEndpoint || exportingXlsx) return;
    setExportingXlsx(true);
    try {
      const blob = await api.download(`/reports/export/excel/${reportEndpoint}`);
      const labelKey = REPORT_LABEL_KEYS[reportEndpoint] ?? 'reports.exportXlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileNamePart(t(labelKey))}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(t('reports.exportXlsxDone'), 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setExportingXlsx(false);
    }
  };

  const handlePrintPdf = () => {
    if (onPrint) void onPrint();
    else window.print();
  };

  if (xlsxOnly) {
    return (
      <div className="flex gap-2">
        <Button variant="secondary" onClick={handleExportXlsx} loading={exportingXlsx} disabled={!reportEndpoint || exportingXlsx}>
          {t('reports.exportXlsx')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={handleExportCsv}>
        {t('reports.exportCsv')}
      </Button>
      {reportEndpoint && (
        <Button variant="secondary" onClick={handleExportXlsx} loading={exportingXlsx} disabled={exportingXlsx}>
          {t('reports.exportXlsx')}
        </Button>
      )}
      <Button variant="secondary" onClick={handlePrintPdf} disabled={printDisabled}>
        {t('reports.exportPdf')}
      </Button>
    </div>
  );
}
