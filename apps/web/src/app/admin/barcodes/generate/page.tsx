'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productAdapter, machineAdapter, warehouseAdapter, warehouseLocationAdapter, maintenanceRequestAdapter, maintenanceTaskAdapter, inventoryCountAdapter } from '../../../../components/f9/lookup-adapters';
import { BarcodeLabel } from '../../../../lib/admin-types';
import type { LookupAdapter } from '../../../../components/f9/types';
import type { MachinePart } from '../../../../lib/admin-types';

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'PRODUCT', label: 'PRODUCT' },
  { value: 'MACHINE', label: 'MACHINE' },
  { value: 'MACHINE_PART', label: 'MACHINE_PART' },
  { value: 'WAREHOUSE', label: 'WAREHOUSE' },
  { value: 'WAREHOUSE_LOCATION', label: 'WAREHOUSE_LOCATION' },
  { value: 'INVENTORY_COUNT', label: 'INVENTORY_COUNT' },
  { value: 'MAINTENANCE_REQUEST', label: 'MAINTENANCE_REQUEST' },
  { value: 'MAINTENANCE_TASK', label: 'MAINTENANCE_TASK' },
];

const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX'];

const machinePartAdapter: LookupAdapter<MachinePart> = {
  endpoint: '/maintenance/machine-parts',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'partNumber'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'partNumber', header: 'Part #', render: (p) => p.partNumber || '-' },
    { key: 'status', header: 'Status', render: (p) => p.status },
  ],
};

export default function BarcodeGeneratePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [entityType, setEntityType] = useState('PRODUCT');
  const [entityId, setEntityId] = useState('');
  const [symbology, setSymbology] = useState('QR_CODE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  const entityAdapter = useMemo(() => {
    switch (entityType) {
      case 'PRODUCT': return productAdapter;
      case 'MACHINE': return machineAdapter;
      case 'MACHINE_PART': return machinePartAdapter;
      case 'WAREHOUSE': return warehouseAdapter;
      case 'WAREHOUSE_LOCATION': return warehouseLocationAdapter;
      case 'INVENTORY_COUNT': return inventoryCountAdapter;
      case 'MAINTENANCE_REQUEST': return maintenanceRequestAdapter;
      case 'MAINTENANCE_TASK': return maintenanceTaskAdapter;
      default: return null;
    }
  }, [entityType]);

  const fetchLabels = useCallback(async () => {
    if (!entityId) return;
    setLoadingLabels(true);
    try {
      const res = await api.get<{ data: BarcodeLabel[] }>(`/barcodes/entities/${entityType}/${entityId}/labels`);
      setLabels(res.data || []);
    } catch { setLabels([]); } finally { setLoadingLabels(false); }
  }, [entityType, entityId]);

  const handleGenerate = async () => {
    if (!entityId) { showToast(t('barcodes.generate.noEntity'), 'error'); return; }
    setGenerating(true);
    try {
      await api.post('/barcodes/labels/generate', {
        entityType, entityId, symbology,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      });
      showToast(t('barcodes.generate.success'), 'success');
      setTitle(''); setDescription('');
      fetchLabels();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); } finally { setGenerating(false); }
  };

  const handleClear = () => {
    setEntityType('PRODUCT'); setEntityId(''); setSymbology('QR_CODE');
    setTitle(''); setDescription(''); setLabels([]);
  };

  const handlePrint = (label: BarcodeLabel) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${label.code}</title>
        <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
        </head><body>
        <h2>${t('barcodes.print.title')}</h2>
        <table>
          <tr><th>${t('barcodes.labelCode')}</th><td>${label.code}</td></tr>
          <tr><th>${t('barcodes.labelValue')}</th><td>${label.value}</td></tr>
          <tr><th>${t('barcodes.symbology')}</th><td>${label.symbology}</td></tr>
          <tr><th>${t('barcodes.entityType')}</th><td>${label.entityType}</td></tr>
          <tr><th>${t('common.status')}</th><td>${label.status}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#666;">${t('barcodes.print.printReady')}</p>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>
      `);
      printWindow.document.close();
    }
  };

  const handleMarkPrinted = async (labelId: string) => {
    try {
      await api.post(`/barcodes/labels/${labelId}/mark-printed`);
      showToast(t('barcodes.print.printedSuccess'), 'success');
      fetchLabels();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: fetchLabels, enabled: !!entityId,
    },
    {
      id: 'generate', labelKey: 'barcodes.generate.generate',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: handleGenerate, enabled: !!entityId,
    },
    {
      id: 'clear', labelKey: 'barcodes.generate.clear',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      onClick: handleClear,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.generate.title')} />
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={t('barcodes.generate.entitySelector')} value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setEntityId(''); setLabels([]); }}
              options={ENTITY_TYPES} />
            <Select label={t('barcodes.symbology')} value={symbology}
              onChange={(e) => setSymbology(e.target.value)}
              options={SYMBOLOGIES.map((s) => ({ value: s, label: s }))} />
            {entityAdapter ? (
              <F9Lookup<MachinePart>
                label={t('barcodes.entityId')}
                value={entityId}
                onChange={(v) => { setEntityId(v); setLabels([]); }}
                adapter={entityAdapter as LookupAdapter<any>}
                placeholder={t('barcodes.generate.entityPlaceholder')}
              />
            ) : (
              <Input label={t('barcodes.entityId')} value={entityId}
                onChange={(e) => { setEntityId(e.target.value); setLabels([]); }}
                placeholder="e.g., entity id" />
            )}
            <Input label={t('barcodes.generate.labelTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="mt-4">
            <Input label={t('barcodes.generate.labelDescription')} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleGenerate} loading={generating} disabled={!entityId}>{t('barcodes.generate.generate')}</Button>
            <Button variant="secondary" onClick={handleClear}>{t('barcodes.generate.clear')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.generate.generatedLabels')}</h3></CardHeader>
        <CardContent>
          {loadingLabels && <LoadingState message={t('common.loading')} />}
          {!loadingLabels && labels.length === 0 && <EmptyState message={t('barcodes.generate.noLabels')} />}
          {!loadingLabels && labels.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelCode')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelValue')}</th>
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
                      <td className="px-4 py-3 text-sm">{label.symbology}</td>
                      <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                      <td className="px-4 py-3 text-sm">{label.printCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handlePrint(label)}>{t('barcodes.print.print')}</Button>
                          <Button variant="secondary" size="sm" onClick={() => handleMarkPrinted(label.id)}>{t('barcodes.print.markPrinted')}</Button>
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
