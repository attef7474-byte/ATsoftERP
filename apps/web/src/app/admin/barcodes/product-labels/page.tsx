'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers } from '../../../../components/admin/admin-action-bar';
import { BarcodeLabel } from '../../../../lib/admin-types';

export default function ProductLabelsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { entityType: 'PRODUCT', limit: 50, page: 1 };
      if (search) params.search = search;
      const res = await api.get<{ data: BarcodeLabel[]; meta: any }>('/barcodes/labels', { params });
      setLabels(res.data || []);
    } catch { setLabels([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchLabels(); }, [fetchLabels]);

  const { exec } = useStableHandlers({ refresh: () => fetchLabels() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, onClick: () => exec('refresh') },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.productLabels.title')} subtitle={t('barcodes.productLabels.subtitle')} />
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('barcodes.productLabels.search')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <Button variant="secondary" onClick={() => setSearch('')}>{t('common.clearSearch')}</Button>
              <Link href="/admin/barcodes/product-labels/designer">
                <Button>{t('barcodes.productLabels.designNew')}</Button>
              </Link>
            </div>
          </div>
          {loading && <LoadingState message={t('common.loading')} />}
          {!loading && labels.length === 0 && <EmptyState message={t('barcodes.productLabels.noLabels')} />}
          {!loading && labels.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelCode')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityId')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.symbology')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.printCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {labels.map((label) => (
                    <tr key={label.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{label.code}</td>
                      <td className="px-4 py-3 text-sm font-mono">{label.value}</td>
                      <td className="px-4 py-3 text-sm">{label.entityId}</td>
                      <td className="px-4 py-3 text-sm">{label.symbology}</td>
                      <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                      <td className="px-4 py-3 text-sm">{label.printCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link href={`/admin/barcodes/product-labels/preview?labelId=${label.id}`}>
                            <Button variant="ghost" size="sm">{t('common.preview')}</Button>
                          </Link>
                          <Link href={`/admin/barcodes/product-labels/print?labelId=${label.id}`}>
                            <Button variant="ghost" size="sm">{t('barcodes.print.print')}</Button>
                          </Link>
                          <Link href={`/admin/barcodes/product-labels/designer?labelId=${label.id}`}>
                            <Button variant="ghost" size="sm">{t('common.edit')}</Button>
                          </Link>
                        </div>
                      </td>
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
