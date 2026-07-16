'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers } from '../../../../components/admin/admin-action-bar';
import { BarcodeLabel } from '../../../../lib/admin-types';

const ENTITY_TYPES = ['', 'PRODUCT', 'MACHINE', 'MACHINE_PART', 'WAREHOUSE', 'WAREHOUSE_LOCATION', 'INVENTORY_COUNT', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK'];

export default function BarcodePrintPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const selectedLabel = useMemo(() => labels.find(l => l.id === selectedId), [labels, selectedId]);

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 50, page: 1 };
      if (search) params.search = search;
      if (entityTypeFilter) params.entityType = entityTypeFilter;
      const res = await api.get<{ data: BarcodeLabel[]; meta: any }>('/barcodes/labels', { params });
      setLabels(res.data || []);
    } catch { setLabels([]); } finally { setLoading(false); }
  }, [search, entityTypeFilter]);

  useEffect(() => { fetchLabels(); }, [fetchLabels]);

  const handleMarkPrinted = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/barcodes/labels/${selectedId}/mark-printed`);
      showToast(t('barcodes.print.printedSuccess'), 'success');
      fetchLabels();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const handlePrint = () => {
    if (selectedLabel) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>${t('barcodes.print.title')}</title>
          <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
          </head><body>
          <h2>${t('barcodes.print.title')}</h2>
          <table>
            <tr><th>${t('barcodes.labelCode')}</th><td>${selectedLabel.code}</td></tr>
            <tr><th>${t('barcodes.labelValue')}</th><td>${selectedLabel.value}</td></tr>
            <tr><th>${t('barcodes.symbology')}</th><td>${selectedLabel.symbology}</td></tr>
            <tr><th>${t('barcodes.entityType')}</th><td>${selectedLabel.entityType}</td></tr>
            <tr><th>${t('common.status')}</th><td>${selectedLabel.status}</td></tr>
            ${selectedLabel.humanReadableValue ? `<tr><th>${t('common.description')}</th><td>${selectedLabel.humanReadableValue}</td></tr>` : ''}
          </table>
          <p style="margin-top:20px;font-size:12px;color:#666;">${t('barcodes.print.printReady')}</p>
          <script>window.onload=function(){window.print();}<\/script>
          </body></html>
        `);
        printWindow.document.close();
      }
    }
  };

  const handleStatusAction = async (action: string) => {
    if (!selectedId) return;
    try {
      await api.patch(`/barcodes/labels/${selectedId}/${action}`);
      showToast(t('common.successUpdated'), 'success');
      fetchLabels();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    print: () => handlePrint(),
    markPrinted: () => handleMarkPrinted(),
    activate: () => handleStatusAction('activate'),
    deactivate: () => handleStatusAction('deactivate'),
    voidLabel: () => handleStatusAction('void'),
    retire: () => handleStatusAction('retire'),
    refresh: () => fetchLabels(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, onClick: () => exec('refresh') },
    { id: 'printLabel', labelKey: 'barcodes.print.print', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>, onClick: () => exec('print'), enabled: !!selectedId },
    { id: 'markPrinted', labelKey: 'barcodes.print.markPrinted', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, onClick: () => exec('markPrinted'), enabled: !!selectedId },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.print.title')} />
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('barcodes.print.searchLabels')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <Select value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)}
                options={ENTITY_TYPES.map((et) => ({ value: et, label: et || t('common.all') }))} placeholder={t('barcodes.entityType')} />
              <Button variant="secondary" onClick={() => { setSearch(''); setEntityTypeFilter(''); }}>{t('common.clearSearch')}</Button>
            </div>
          </div>
          {loading && <LoadingState message={t('barcodes.print.loadingLabels')} />}
          {!loading && labels.length === 0 && <EmptyState message={t('barcodes.print.noLabels')} />}
          {!loading && labels.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelCode')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.symbology')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.printCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.printedAt')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {labels.map((label) => (
                    <tr key={label.id} onClick={() => setSelectedId(label.id)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === label.id ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}>
                      <td className="px-4 py-3 text-sm">{label.code}</td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{label.value}</td>
                      <td className="px-4 py-3 text-sm">{label.entityType}</td>
                      <td className="px-4 py-3 text-sm">{label.symbology}</td>
                      <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                      <td className="px-4 py-3 text-sm">{label.printCount ?? 0}</td>
                      <td className="px-4 py-3 text-sm">{label.lastPrintedAt ? new Date(label.lastPrintedAt).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLabel && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.print.preview')}</h3></CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-gray-50 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">{t('barcodes.labelCode')}: {selectedLabel.code}</p>
                <p className="text-lg font-bold font-mono mb-2">{selectedLabel.value}</p>
                {selectedLabel.humanReadableValue && <p className="text-sm text-gray-700">{selectedLabel.humanReadableValue}</p>}
                <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
                  <span>{t('barcodes.symbology')}: {selectedLabel.symbology}</span>
                  <span>{t('barcodes.entityType')}: {selectedLabel.entityType}</span>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={handlePrint}>{t('barcodes.print.print')}</Button>
                  <Button variant="secondary" onClick={handleMarkPrinted}>{t('barcodes.print.markPrinted')}</Button>
                  {selectedLabel.status !== 'ACTIVE' && (
                    <Button variant="secondary" onClick={() => handleStatusAction('activate')}>{t('barcodes.activateLabel')}</Button>
                  )}
                  {selectedLabel.status === 'ACTIVE' && (
                    <>
                      <Button variant="secondary" onClick={() => handleStatusAction('deactivate')}>{t('barcodes.deactivateLabel')}</Button>
                      <Button variant="secondary" onClick={() => handleStatusAction('void')}>{t('barcodes.voidLabel')}</Button>
                    </>
                  )}
                  {selectedLabel.status !== 'RETIRED' && selectedLabel.status !== 'VOID' && (
                    <Button variant="secondary" onClick={() => handleStatusAction('retire')}>{t('barcodes.retireLabel')}</Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
