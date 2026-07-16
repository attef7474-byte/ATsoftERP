'use client';
import React, { useState, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardHeader, CardContent, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../components/admin/admin-action-bar';

const ENTITY_TYPES = ['PRODUCT', 'MACHINE', 'MACHINE_PART', 'WAREHOUSE', 'WAREHOUSE_LOCATION', 'INVENTORY_COUNT', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK'];
const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX'];

export default function BarcodeGeneratePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [entityType, setEntityType] = useState('PRODUCT');
  const [entityId, setEntityId] = useState('');
  const [symbology, setSymbology] = useState('QR_CODE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [labels, setLabels] = useState<any[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  const fetchLabels = useCallback(async () => {
    if (!entityId) return;
    setLoadingLabels(true);
    try {
      const res = await api.get<any[]>(`/barcodes/entities/${entityType}/${entityId}/labels`);
      setLabels(Array.isArray(res) ? res : []);
    } catch {
      setLabels([]);
    } finally {
      setLoadingLabels(false);
    }
  }, [entityType, entityId]);

  const handleGenerate = async () => {
    if (!entityId) { showToast(t('barcodes.generate.noEntity'), 'error'); return; }
    if (!entityType) { showToast(t('validation.required'), 'error'); return; }
    setGenerating(true);
    try {
      const payload: any = { entityType, entityId, symbology };
      if (title) payload.title = title;
      if (description) payload.description = description;
      await api.post('/barcodes/labels/generate', payload);
      showToast(t('barcodes.generate.success'), 'success');
      setTitle('');
      setDescription('');
      fetchLabels();
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = () => {
    setEntityType('PRODUCT');
    setEntityId('');
    setSymbology('QR_CODE');
    setTitle('');
    setDescription('');
    setLabels([]);
  };

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, onClick: fetchLabels, enabled: !!entityId },
    {
      id: 'generate', labelKey: 'barcodes.generate.generate', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: handleGenerate, enabled: !!entityId,
    },
    {
      id: 'clear', labelKey: 'barcodes.generate.clear', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      onClick: handleClear,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.generate.title')} />
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={t('barcodes.generate.entitySelector')} value={entityType} onChange={(e) => { setEntityType(e.target.value); setEntityId(''); setLabels([]); }}
              options={ENTITY_TYPES.map((et) => ({ value: et, label: et }))} />
            <Select label={t('barcodes.symbology')} value={symbology} onChange={(e) => setSymbology(e.target.value)}
              options={SYMBOLOGIES.map((s) => ({ value: s, label: s }))} />
            <Input label={t('barcodes.entityId')} value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="e.g., product id" />
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.createdAt')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {labels.map((label: any) => (
                    <tr key={label.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{label.code}</td>
                      <td className="px-4 py-3 text-sm font-mono">{label.value}</td>
                      <td className="px-4 py-3 text-sm">{label.symbology}</td>
                      <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                      <td className="px-4 py-3 text-sm">{label.createdAt ? new Date(label.createdAt).toLocaleDateString() : '-'}</td>
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
