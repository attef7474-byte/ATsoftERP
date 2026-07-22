'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../components/admin/admin-action-bar';
import { BarcodeLabel } from '../../../../lib/admin-types';

const ENTITY_TYPES = ['', 'PRODUCT', 'MACHINE', 'MACHINE_PART', 'WAREHOUSE', 'WAREHOUSE_LOCATION', 'INVENTORY_COUNT', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK'];
const STATUSES = ['', 'ACTIVE', 'INACTIVE', 'VOID', 'RETIRED'];

export default function BarcodeRecordsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { limit: 20, page };
      if (search) params.search = search;
      if (entityType) params.entityType = entityType;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: BarcodeLabel[]; meta: { total: number; totalPages: number; page: number } }>('/barcodes/labels', { params });
      const listResult = unwrapApiList<BarcodeLabel, { total?: number; totalPages?: number; page?: number }>(res);
      setLabels(listResult.data);
      setTotal(listResult.meta?.total ?? listResult.total ?? 0);
      setTotalPages(listResult.meta?.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
      setLabels([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, statusFilter, t]);

  useEffect(() => { fetchLabels(); }, [fetchLabels]);

  const handleClear = () => {
    setSearch(''); setEntityType(''); setStatusFilter(''); setPage(1);
  };

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: fetchLabels,
    },
  ]);

  const columns = [
    { key: 'code', header: t('barcodes.labelCode') },
    { key: 'value', header: t('barcodes.labelValue') },
    { key: 'entityType', header: t('barcodes.entityType') },
    { key: 'symbology', header: t('barcodes.symbology') },
    { key: 'status', header: t('common.status'), render: (l: BarcodeLabel) => <StatusBadge status={l.status} /> },
    { key: 'printCount', header: t('barcodes.printCount'), render: (l: BarcodeLabel) => l.printCount ?? 0 },
    { key: 'scanCount', header: t('barcodes.scanCount'), render: (l: BarcodeLabel) => l.scanCount ?? 0 },
    { key: 'createdAt', header: t('common.createdAt'), render: (l: BarcodeLabel) => l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.records.title')} />

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('barcodes.records.searchLabels')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
                options={ENTITY_TYPES.map((et) => ({ value: et, label: et || t('common.all') }))} placeholder={t('barcodes.entityType')} />
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={STATUSES.map((s) => ({ value: s, label: s || t('common.all') }))} placeholder={t('common.status')} />
              <Button variant="secondary" onClick={handleClear}>{t('common.clearSearch')}</Button>
            </div>
          </div>

          {error && <ErrorState message={error} onRetry={fetchLabels} />}

          {loading && <LoadingState message={t('common.loading')} />}

          {!loading && !error && labels.length === 0 && (
            <EmptyState message={t('barcodes.records.noRecords')} />
          )}

          {!loading && !error && labels.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {labels.map((label) => (
                      <tr key={label.id} onClick={() => router.push(`/admin/barcodes/records/${label.id}`)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{label.code}</td>
                        <td className="px-4 py-3 text-sm font-mono max-w-[200px] truncate">{label.value}</td>
                        <td className="px-4 py-3 text-sm">{label.entityType}</td>
                        <td className="px-4 py-3 text-sm">{label.symbology}</td>
                        <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                        <td className="px-4 py-3 text-sm">{label.printCount ?? 0}</td>
                        <td className="px-4 py-3 text-sm">{label.scanCount ?? 0}</td>
                        <td className="px-4 py-3 text-sm">{label.createdAt ? new Date(label.createdAt).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
