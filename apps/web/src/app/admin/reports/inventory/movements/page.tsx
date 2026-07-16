'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, warehouseAdapter, productAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

export default function MovementsReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [warehouseId, setWarehouseId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (warehouseId) params.warehouseId = warehouseId;
      const res = await api.get<any>('/reports/inventory/movements', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, warehouseId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setWarehouseId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const columns = [
    { key: 'movementNumber', header: t('inventoryCounting.movementNumber'), render: (r: any) => <button onClick={() => router.push(`/admin/inventory/movements/${r.id}`)} className="text-blue-600 hover:underline">{r.movementNumber}</button> },
    { key: 'movementType', header: t('inventoryCounting.movementType') },
    { key: 'warehouse', header: t('reports.warehouse'), render: (r: any) => r.warehouse?.name || '-' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
    { key: 'movementDate', header: t('common.date'), render: (r: any) => r.movementDate ? new Date(r.movementDate).toLocaleDateString() : '-' },
    { key: 'notes', header: t('common.notes'), render: (r: any) => r.notes || '-' },
  ];

  return (
    <ReportPageShell title={t('reports.movementsReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={warehouseAdapter} value={warehouseId} onChange={setWarehouseId} placeholder={t('reports.warehouse')} /></div>
          <div className="w-40">
            <Select value={filters.countStatus || ''} onChange={e => setFilters((f: any) => ({ ...f, countStatus: e.target.value || undefined, page: 1 }))} placeholder={t('reports.status')} options={[
              { value: 'DRAFT', label: t('reports.draft') },
              { value: 'POSTED', label: t('reports.posted') },
              { value: 'CANCELLED', label: t('reports.cancelled') },
            ]} />
          </div>
          <div className="w-36"><Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters((f: any) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateFrom')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateTo || ''} onChange={e => setFilters((f: any) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateTo')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton filename="inventory-movements" headers={['Number', 'Type', 'Warehouse', 'Status', 'Date', 'Notes']} rows={data.rows}
                mapRow={(r) => [r.movementNumber, r.movementType, r.warehouse?.name || '', r.status, r.movementDate ? new Date(r.movementDate).toLocaleDateString() : '', r.notes || '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} onRowClick={(r: any) => router.push(`/admin/inventory/movements/${r.id}`)} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
