'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface SearchResult {
  id: string; entityType: string; code: string; title: string;
  subtitle: string; description: string; status: string; route: string;
}

const ENTITY_LABELS: Record<string, string> = {
  company: 'core.companies', branch: 'core.branches', department: 'core.departments',
  warehouse: 'inventory.warehouses', warehouseLocation: 'inventory.locations.title',
  product: 'inventory.products', machine: 'maintenance.machines', user: 'access.users',
  role: 'access.roles', maintenanceRequest: 'maintenance.maintenanceRequests',
  inventoryCount: 'inventoryCounting.counts',
};

function ResultsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const entityType = searchParams.get('type') || '';
  const [data, setData] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchData = useCallback(async () => {
    if (!query) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const params: any = { q: query, page, limit };
      if (entityType) params.types = entityType;
      const res = await api.get<{ data: any[]; meta: { total: number } }>('/search', { params });
      setData(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) { setError(err?.message || 'Search failed'); }
    finally { setLoading(false); }
  }, [query, entityType, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / limit);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/search'),
    refresh: () => fetchData(),
    clear: () => router.push('/admin/search'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('search.results')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('search.resultsFor')} &quot;{query}&quot; ({total} {t('search.resultsFound').toLowerCase()})</p>
      {data.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-gray-500">{t('search.noResults')}</p></div>
      ) : (
        <>
          <div className="space-y-1 mb-4">
            {data.map(item => (
              <div
                key={item.id}
                onClick={() => router.push(item.route)}
                className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
              >
                <div className="text-sm font-medium text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t(ENTITY_LABELS[item.entityType] as any) || item.entityType} — {item.subtitle}{item.description ? ` — ${item.description}` : ''}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-gray-500">{t('search.page')} {page} / {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">{t('common.previous')}</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">{t('common.next')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResultsContent />
    </Suspense>
  );
}
