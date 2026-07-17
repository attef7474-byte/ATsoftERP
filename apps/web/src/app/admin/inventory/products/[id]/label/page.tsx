'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';
import { Product, BarcodeLabel } from '../../../../../../lib/admin-types';

export default function ProductLabelPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [productRes, labelsRes] = await Promise.all([
        api.get<Product>(`/inventory/products/${id}`),
        api.get<{ data: BarcodeLabel[] }>(`/barcodes/entities/PRODUCT/${id}/labels`).catch(() => ({ data: [] })),
      ]);
      setProduct(productRes);
      setLabels(labelsRes.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateLabel = async () => {
    if (!product) return;
    setGenerating(true);
    try {
      await api.post('/barcodes/labels/generate', { entityType: 'PRODUCT', entityId: product.id });
      showToast(t('common.successCreated'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setGenerating(false); }
  };

  const handleMarkPrinted = async (labelId: string) => {
    try {
      await api.post(`/barcodes/labels/${labelId}/mark-printed`);
      showToast(t('barcodes.print.printedSuccess'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const handleStatusAction = async (labelId: string, action: string) => {
    try {
      await api.patch(`/barcodes/labels/${labelId}/${action}`);
      showToast(t('common.successUpdated'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
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
          <tr><th>${t('common.status')}</th><td>${label.status}</td></tr>
          ${label.humanReadableValue ? `<tr><th>${t('common.description')}</th><td>${label.humanReadableValue}</td></tr>` : ''}
        </table>
        <p style="margin-top:20px;font-size:12px;color:#666;">${t('barcodes.print.printReady')}</p>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>
      `);
      printWindow.document.close();
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    generate: () => handleGenerateLabel(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'generate', labelKey: 'barcodes.generateLabel', icon: <ActionAddIcon />, onClick: () => exec('generate'), enabled: !!product },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.productLabels')} />

      {product && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.productInfo')}</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">{t('common.name')}</p><p className="font-medium">{product.name}</p></div>
              <div><p className="text-sm text-gray-500">{t('common.code')}</p><p>{product.code}</p></div>
              <div><p className="text-sm text-gray-500">{t('inventory.unit')}</p><p>{product.unit}</p></div>
              <div><p className="text-sm text-gray-500">{t('common.status')}</p><StatusBadge status={product.status} /></div>
              {product.description && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('common.description')}</p><p>{product.description}</p></div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={handleGenerateLabel} loading={generating}>{t('barcodes.generateLabel')}</Button>
        <Link href={`/admin/inventory/products/${id}/qr`}>
          <Button variant="secondary">{t('barcodes.viewQR')}</Button>
        </Link>
        <Link href={`/admin/barcodes/print`}>
          <Button variant="secondary">{t('barcodes.labelDesigner')}</Button>
        </Link>
      </div>

      {labels.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.barcodeLabels')}</h3></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelCode')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.labelValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.symbology')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {labels.map((label) => (
                    <tr key={label.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">{label.code}</td>
                      <td className="px-4 py-3 text-sm font-mono">{label.value}</td>
                      <td className="px-4 py-3 text-sm">{label.symbology}</td>
                      <td className="px-4 py-3"><StatusBadge status={label.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="secondary" size="sm" onClick={() => handlePrint(label)}>{t('barcodes.print.print')}</Button>
                          <Button variant="secondary" size="sm" onClick={() => handleMarkPrinted(label.id)}>{t('barcodes.print.markPrinted')}</Button>
                          {label.status !== 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => handleStatusAction(label.id, 'activate')}>{t('barcodes.activateLabel')}</Button>}
                          {label.status === 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => handleStatusAction(label.id, 'deactivate')}>{t('barcodes.deactivateLabel')}</Button>}
                          {label.status === 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => handleStatusAction(label.id, 'void')}>{t('barcodes.voidLabel')}</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {labels.length === 0 && !loading && (
        <Card>
          <CardContent>
            <p className="text-gray-500 text-center py-8">{t('barcodes.noLabels')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
