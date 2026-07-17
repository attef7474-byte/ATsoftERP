'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers } from '../../../../../components/admin/admin-action-bar';
import { BarcodeLabel, BarcodeScanEvent } from '../../../../../lib/admin-types';

export default function BarcodeRecordDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [label, setLabel] = useState<BarcodeLabel | null>(null);
  const [scanEvents, setScanEvents] = useState<BarcodeScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLabel = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<BarcodeLabel & { scanEvents?: BarcodeScanEvent[] }>(`/barcodes/labels/${id}`);
      setLabel(res);
      setScanEvents((res as any).scanEvents ?? []);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
      showToast(err?.message || t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, t, showToast]);

  useEffect(() => { fetchLabel(); }, [fetchLabel]);

  const handleStatusAction = async (action: string) => {
    if (!id) return;
    try {
      await api.patch(`/barcodes/labels/${id}/${action}`);
      showToast(t('common.successUpdated'), 'success');
      fetchLabel();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const handleMarkPrinted = async () => {
    if (!id) return;
    try {
      await api.post(`/barcodes/labels/${id}/mark-printed`);
      showToast(t('barcodes.print.printedSuccess'), 'success');
      fetchLabel();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const handlePrint = () => {
    if (!label) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${t('barcodes.print.title')}</title>
        <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
        </head><body>
        <h2>${t('barcodes.print.title')}</h2>
        <table>
          <tr><th>${t('barcodes.labelCode')}</th><td>${label.code}</td></tr>
          <tr><th>${t('barcodes.labelValue')}</th><td>${label.value}</td></tr>
          <tr><th>${t('barcodes.symbology')}</th><td>${label.symbology}</td></tr>
          <tr><th>${t('barcodes.entityType')}</th><td>${label.entityType}</td></tr>
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
    refresh: () => fetchLabel(),
    activate: () => handleStatusAction('activate'),
    deactivate: () => handleStatusAction('deactivate'),
    voidLabel: () => handleStatusAction('void'),
    retire: () => handleStatusAction('retire'),
    markPrinted: () => handleMarkPrinted(),
    print: () => handlePrint(),
    back: () => router.push('/admin/barcodes/records'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'barcodes.print.print', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>, onClick: () => exec('print'), enabled: !!label },
  ]);

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={fetchLabel} />;
  if (!label) return <EmptyState message={t('barcodes.records.notFound')} />;

  const detailFields = [
    { label: t('barcodes.labelCode'), value: label.code },
    { label: t('barcodes.labelValue'), value: label.value, mono: true },
    { label: t('barcodes.symbology'), value: label.symbology },
    { label: t('barcodes.entityType'), value: label.entityType },
    { label: t('barcodes.entityId'), value: label.entityId },
    { label: t('common.status'), value: <StatusBadge status={label.status} /> },
    { label: t('barcodes.generate.labelTitle'), value: label.title ?? '-' },
    { label: t('barcodes.printCount'), value: label.printCount ?? 0 },
    { label: t('barcodes.scanCount'), value: label.scanCount ?? 0 },
    { label: t('barcodes.lastPrintedAt'), value: label.lastPrintedAt ? new Date(label.lastPrintedAt).toLocaleString() : '-' },
    { label: t('barcodes.lastScannedAt'), value: label.lastScannedAt ? new Date(label.lastScannedAt).toLocaleString() : '-' },
    { label: t('common.createdAt'), value: label.createdAt ? new Date(label.createdAt).toLocaleString() : '-' },
    { label: t('common.updatedAt'), value: label.updatedAt ? new Date(label.updatedAt).toLocaleString() : '-' },
  ];

  if (label.humanReadableValue) {
    detailFields.splice(4, 0, { label: t('common.description'), value: label.humanReadableValue });
  }
  if (label.qrPayload) {
    detailFields.push({ label: 'QR Payload', value: <code className="text-xs break-all bg-gray-50 p-1 rounded">{label.qrPayload}</code> });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${t('barcodes.records.detail')}: ${label.code}`} />

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.records.labelInfo')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detailFields.map((f) => (
              <div key={f.label}>
                <p className="text-sm text-gray-500">{f.label}</p>
                <p className={`font-medium ${f.mono ? 'font-mono text-sm' : ''}`}>{f.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {label.status === 'ACTIVE' ? (
          <>
            <Button variant="secondary" onClick={() => exec('deactivate')}>{t('barcodes.deactivateLabel')}</Button>
            <Button variant="secondary" onClick={() => exec('voidLabel')}>{t('barcodes.voidLabel')}</Button>
          </>
        ) : label.status !== 'VOID' && label.status !== 'RETIRED' ? (
          <Button variant="secondary" onClick={() => exec('activate')}>{t('barcodes.activateLabel')}</Button>
        ) : null}
        {label.status !== 'RETIRED' && label.status !== 'VOID' && (
          <Button variant="secondary" onClick={() => exec('retire')}>{t('barcodes.retireLabel')}</Button>
        )}
        <Button variant="secondary" onClick={handleMarkPrinted}>{t('barcodes.print.markPrinted')}</Button>
        <Button onClick={handlePrint}>{t('barcodes.print.print')}</Button>
        <Link href={`/admin/barcodes/preview?id=${label.id}`}>
          <Button variant="secondary">{t('barcodes.preview.title')}</Button>
        </Link>
      </div>

      {scanEvents.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.scanEvents')} ({scanEvents.length})</h3></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scanResult')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.purpose')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedAt')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scanEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">{event.scannedValue}</td>
                      <td className="px-4 py-3"><StatusBadge status={event.result} /></td>
                      <td className="px-4 py-3 text-sm">{event.purpose}</td>
                      <td className="px-4 py-3 text-sm">{event.scannedAt ? new Date(event.scannedAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
