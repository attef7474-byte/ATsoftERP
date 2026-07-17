'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers } from '../../../../components/admin/admin-action-bar';
import { BarcodeLabel } from '../../../../lib/admin-types';

export default function BarcodePreviewPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const selectedLabel = labels.find((l) => l.id === selectedId) ?? null;

  const fetchLabels = useCallback(async () => {
    setLoadingLabels(true);
    try {
      const res = await api.get<{ data: BarcodeLabel[] }>('/barcodes/labels', { params: { limit: '100' } });
      setLabels(res.data || []);
    } catch {
      setLabels([]);
    } finally {
      setLoadingLabels(false);
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!selectedId) return;
    setLoadingPreview(true);
    setPreviewError('');
    setPreviewData(null);
    try {
      const res = await api.get<any>(`/barcodes/labels/${selectedId}/preview`);
      setPreviewData(res);
    } catch (err: any) {
      setPreviewError(err?.message || t('common.error'));
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedId, t]);

  useEffect(() => { fetchLabels(); }, [fetchLabels]);
  useEffect(() => { if (selectedId) fetchPreview(); }, [selectedId, fetchPreview]);

  const handlePrint = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/barcodes/labels/${selectedId}/print`);
    } catch {
      // proceed with browser print regardless
    }
    const label = selectedLabel;
    if (!label) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let qrHtml = '';
      if (label.symbology === 'QR_CODE' && previewData?.qrPayload) {
        qrHtml = `<div style="text-align:center;margin:20px 0;"><p style="font-size:14px;color:#333;">QR Payload:</p><p style="font-family:monospace;font-size:12px;word-break:break-all;background:#f5f5f5;padding:10px;border-radius:4px;">${previewData.qrPayload}</p></div>`;
      }
      printWindow.document.write(`
        <html><head><title>${t('barcodes.print.title')}</title>
        <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
        </head><body>
        <h2>${t('barcodes.preview.title')}</h2>
        <table>
          <tr><th>${t('barcodes.labelCode')}</th><td>${label.code}</td></tr>
          <tr><th>${t('barcodes.labelValue')}</th><td>${label.value}</td></tr>
          <tr><th>${t('barcodes.symbology')}</th><td>${label.symbology}</td></tr>
          <tr><th>${t('barcodes.entityType')}</th><td>${label.entityType}</td></tr>
          <tr><th>${t('common.status')}</th><td>${label.status}</td></tr>
          ${label.title ? `<tr><th>${t('barcodes.generate.labelTitle')}</th><td>${label.title}</td></tr>` : ''}
          ${label.humanReadableValue ? `<tr><th>${t('common.description')}</th><td>${label.humanReadableValue}</td></tr>` : ''}
        </table>
        ${qrHtml}
        <p style="margin-top:20px;font-size:12px;color:#666;">${t('barcodes.print.printReady')}</p>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = () => {
    if (!selectedId) return;
    const url = `/api/barcodes/labels/${selectedId}/download`;
    window.open(url, '_blank');
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchLabels(),
    print: () => handlePrint(),
    download: () => handleDownload(),
  });

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: () => exec('refresh'),
    },
    {
      id: 'print', labelKey: 'barcodes.print.print',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
      onClick: () => exec('print'), enabled: !!selectedId,
    },
    {
      id: 'download', labelKey: 'barcodes.preview.download',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      onClick: () => exec('download'), enabled: !!selectedId,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.preview.title')} />

      <Card>
        <CardContent>
          {loadingLabels && <LoadingState message={t('common.loading')} />}
          {!loadingLabels && labels.length === 0 && <EmptyState message={t('barcodes.preview.noLabels')} />}
          {!loadingLabels && labels.length > 0 && (
            <div className="max-w-md">
              <Select
                label={t('barcodes.preview.selectLabel')}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                options={labels.map((l) => ({ value: l.id, label: `[${l.code}] ${l.value}` }))}
                placeholder={t('barcodes.preview.selectPlaceholder')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLabel && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.preview.labelDetails')}</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">{t('barcodes.labelCode')}</p><p className="font-medium">{selectedLabel.code}</p></div>
              <div><p className="text-sm text-gray-500">{t('barcodes.labelValue')}</p><p className="font-mono font-medium">{selectedLabel.value}</p></div>
              <div><p className="text-sm text-gray-500">{t('barcodes.symbology')}</p><p>{selectedLabel.symbology}</p></div>
              <div><p className="text-sm text-gray-500">{t('common.status')}</p><StatusBadge status={selectedLabel.status} /></div>
              <div><p className="text-sm text-gray-500">{t('barcodes.entityType')}</p><p>{selectedLabel.entityType}</p></div>
              <div><p className="text-sm text-gray-500">{t('barcodes.entityId')}</p><p>{selectedLabel.entityId}</p></div>
              {selectedLabel.title && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('barcodes.generate.labelTitle')}</p><p>{selectedLabel.title}</p></div>}
              {selectedLabel.humanReadableValue && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('common.description')}</p><p>{selectedLabel.humanReadableValue}</p></div>}
              {selectedLabel.qrPayload && <div className="md:col-span-2"><p className="text-sm text-gray-500">QR Payload</p><p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">{selectedLabel.qrPayload}</p></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {loadingPreview && <LoadingState message={t('barcodes.preview.loadingPreview')} />}

      {previewError && !loadingPreview && (
        <ErrorState message={previewError} onRetry={fetchPreview} />
      )}

      {previewData && !loadingPreview && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.preview.previewData')}</h3></CardHeader>
          <CardContent>
            {selectedLabel?.symbology === 'QR_CODE' && previewData?.qrPayload ? (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('barcodes.preview.qrPayload')}</p>
                <p className="font-mono text-xs break-all bg-white p-3 rounded border">{previewData.qrPayload}</p>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData).map((key) => (
                      <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    {Object.values(previewData).map((val: any, idx: number) => (
                      <td key={idx} className="px-4 py-3 text-sm font-mono">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedLabel && !loadingPreview && (
        <div className="flex gap-3">
          <Button onClick={handlePrint}>{t('barcodes.print.print')}</Button>
          <Button variant="secondary" onClick={handleDownload}>{t('barcodes.preview.download')}</Button>
        </div>
      )}
    </div>
  );
}
