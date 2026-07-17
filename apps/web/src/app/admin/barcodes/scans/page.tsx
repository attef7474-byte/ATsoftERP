'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { BarcodeScanEvent, PaginatedResponse } from '../../../../lib/admin-types';

const PURPOSES = ['', 'GENERAL_LOOKUP', 'INVENTORY_COUNTING', 'MAINTENANCE_LOOKUP', 'MACHINE_CHECK', 'PART_LOOKUP'];
const RESULTS = ['', 'SUCCESS', 'NOT_FOUND', 'ERROR'];
const ENTITY_TYPES = ['', 'PRODUCT', 'MACHINE', 'MACHINE_PART', 'WAREHOUSE', 'WAREHOUSE_LOCATION', 'INVENTORY_COUNT', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK'];

export default function ScanHistoryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [scans, setScans] = useState<BarcodeScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchScans = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (purposeFilter) params.purpose = purposeFilter;
      if (resultFilter) params.result = resultFilter;
      if (entityTypeFilter) params.entityType = entityTypeFilter;
      const res = await api.get<PaginatedResponse<BarcodeScanEvent>>('/barcodes/scans', { params });
      setScans(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
      setScans([]);
    } finally { setLoading(false); }
  }, [page, search, purposeFilter, resultFilter, entityTypeFilter, t]);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  const handleClear = () => {
    setSearch(''); setPurposeFilter(''); setResultFilter(''); setEntityTypeFilter(''); setPage(1);
  };

  const { exec } = useStableHandlers({ refresh: () => fetchScans() });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.scanHistory.title')} />

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('barcodes.scan.searchPlaceholder')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <Select value={purposeFilter} onChange={(e) => { setPurposeFilter(e.target.value); setPage(1); }}
                options={PURPOSES.map((p) => ({ value: p, label: p ? t(`barcodes.scan.${p.toLowerCase()}`) : t('common.all') }))} />
              <Select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
                options={RESULTS.map((r) => ({ value: r, label: r || t('common.all') }))} />
              <Select value={entityTypeFilter} onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
                options={ENTITY_TYPES.map((et) => ({ value: et, label: et || t('common.all') }))} />
              <Button variant="secondary" onClick={handleClear}>{t('common.clearSearch')}</Button>
            </div>
          </div>

          {loading && <LoadingState />}
          {error && !loading && <ErrorState message={error} onRetry={fetchScans} />}
          {!loading && !error && scans.length === 0 && <EmptyState message={t('barcodes.scanHistory.noScans')} />}

          {!loading && !error && scans.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedValue')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.purpose')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scanResult')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityType')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityId')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.source')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scans.map((s) => (
                      <tr key={s.id} onClick={() => router.push(`/admin/barcodes/scans/${s.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono max-w-[200px] truncate">{s.scannedValue}</td>
                        <td className="px-4 py-3 text-sm">{s.purpose}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.result} /></td>
                        <td className="px-4 py-3 text-sm">{s.entityType || '-'}</td>
                        <td className="px-4 py-3 text-sm">{s.entityId || '-'}</td>
                        <td className="px-4 py-3 text-sm">{s.source || '-'}</td>
                        <td className="px-4 py-3 text-sm">{s.scannedAt ? new Date(s.scannedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
