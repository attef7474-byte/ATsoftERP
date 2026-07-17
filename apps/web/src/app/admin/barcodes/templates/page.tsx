'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, PageHeader, Card, CardContent, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../components/admin/admin-action-bar';
import { BarcodeLabelTemplate } from '../../../../lib/admin-types';

export default function BarcodeTemplatesListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [templates, setTemplates] = useState<BarcodeLabelTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (search) params.search = search;
      const res = await api.get<{ data: BarcodeLabelTemplate[] }>('/barcodes/templates', { params });
      setTemplates(res.data || []);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: fetchTemplates,
    },
    {
      id: 'new', labelKey: 'common.new',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => router.push('/admin/barcodes/templates/new'),
    },
  ]);

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.templates.title')} />
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <Button variant="secondary" onClick={() => setSearch('')}>{t('common.clear')}</Button>
              <Button onClick={() => router.push('/admin/barcodes/templates/new')}>{t('common.new')}</Button>
            </div>
          </div>
          {loading && <LoadingState message={t('common.loading')} />}
          {!loading && error && <ErrorState message={error} onRetry={fetchTemplates} />}
          {!loading && !error && filtered.length === 0 && <EmptyState message={t('barcodes.templates.noTemplates')} />}
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.templateCode')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.symbology')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.createdAt')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((tpl) => (
                    <tr key={tpl.id} onClick={() => router.push(`/admin/barcodes/templates/${tpl.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono">{tpl.code}</td>
                      <td className="px-4 py-3 text-sm">{tpl.name}</td>
                      <td className="px-4 py-3 text-sm">{tpl.symbology}</td>
                      <td className="px-4 py-3 text-sm">{tpl.entityType || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={tpl.status} /></td>
                      <td className="px-4 py-3 text-sm">{new Date(tpl.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
