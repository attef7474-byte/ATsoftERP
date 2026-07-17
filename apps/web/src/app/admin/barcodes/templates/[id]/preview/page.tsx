'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../../../components/admin/admin-action-bar';
import { BarcodeLabelTemplate } from '../../../../../../lib/admin-types';

export default function BarcodeTemplatePreviewPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<BarcodeLabelTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: BarcodeLabelTemplate }>(`/barcodes/templates/${id}`);
      setTemplate(res.data);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const handlePrint = () => {
    if (!template) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${template.code}</title>
        <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}h2{color:#333}pre{background:#f5f5f5;padding:12px;border-radius:4px;font-size:12px;overflow-x:auto}.preview-card{border:1px dashed #999;padding:16px;margin-top:16px;text-align:center}</style>
        </head><body>
        <h2>${t('barcodes.templates.preview')}</h2>
        <table>
          <tr><th>${t('barcodes.templateCode')}</th><td>${template.code}</td></tr>
          <tr><th>${t('common.name')}</th><td>${template.name}</td></tr>
          <tr><th>${t('barcodes.symbology')}</th><td>${template.symbology}</td></tr>
          <tr><th>${t('barcodes.entityType')}</th><td>${template.entityType || '-'}</td></tr>
          <tr><th>${t('barcodes.widthMm')} (mm)</th><td>${template.widthMm != null ? template.widthMm : '-'}</td></tr>
          <tr><th>${t('barcodes.heightMm')} (mm)</th><td>${template.heightMm != null ? template.heightMm : '-'}</td></tr>
          <tr><th>${t('common.status')}</th><td>${template.status}</td></tr>
        </table>
        <div class="preview-card" style="${template.widthMm ? `width:${template.widthMm}mm` : ''}${template.heightMm ? `;height:${template.heightMm}mm` : ''}">
          <p style="font-size:11px;color:#666;">${template.widthMm ? `${template.widthMm}mm x ${template.heightMm || '?'}mm` : t('barcodes.templates.noDimensions')}</p>
        </div>
        ${template.templateData ? `<h3 style="margin-top:20px;">${t('barcodes.templateData')}</h3><pre>${template.templateData}</pre>` : ''}
        <p style="margin-top:20px;font-size:12px;color:#666;">${t('barcodes.print.printReady')}</p>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>
      `);
      printWindow.document.close();
    }
  };

  useRegisterAdminActions([
    {
      id: 'print', labelKey: 'common.print',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
      onClick: handlePrint, enabled: !!template,
    },
    {
      id: 'back', labelKey: 'common.back',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
      onClick: () => router.push(`/admin/barcodes/templates/${id}`),
    },
  ]);

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={fetchTemplate} />;
  if (!template) return <EmptyState message={t('common.notFound')} />;

  return (
    <div className="space-y-6">
      <PageHeader title={`${t('barcodes.templates.preview')} - ${template.name}`} actions={
        <Button variant="secondary" onClick={() => router.push(`/admin/barcodes/templates/${id}`)}>{t('common.back')}</Button>
      } />
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.templates.templateInfo')}</h3></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><dt className="text-sm font-medium text-gray-500">{t('barcodes.templateCode')}</dt><dd className="mt-1 text-sm text-gray-900">{template.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.name')}</dt><dd className="mt-1 text-sm text-gray-900">{template.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('barcodes.symbology')}</dt><dd className="mt-1 text-sm text-gray-900">{template.symbology}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('barcodes.entityType')}</dt><dd className="mt-1 text-sm text-gray-900">{template.entityType || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1 text-sm"><StatusBadge status={template.status} /></dd></div>
          </dl>
        </CardContent>
      </Card>

      {template.templateData && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.templateData')}</h3></CardHeader>
          <CardContent>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{template.templateData}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.templates.dimensionsPreview')}</h3></CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div
              className="border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-50"
              style={{
                width: template.widthMm ? `${Math.min(template.widthMm * 2, 400)}px` : '200px',
                height: template.heightMm ? `${Math.min(template.heightMm * 2, 300)}px` : '150px',
              }}
            >
              <div className="text-center text-gray-500">
                <p className="text-sm font-medium">{template.widthMm ? `${template.widthMm} mm` : '?'} x {template.heightMm ? `${template.heightMm} mm` : '?'}</p>
                <p className="text-xs mt-1">{template.code}</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <Button onClick={handlePrint}>{t('common.print')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
