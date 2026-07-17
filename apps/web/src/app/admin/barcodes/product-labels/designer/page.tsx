'use client';
import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { productAdapter } from '../../../../../components/f9/lookup-adapters';
import { BarcodeLabel, BarcodeLabelTemplate } from '../../../../../lib/admin-types';

export default function ProductLabelDesignerPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [productId, setProductId] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [title, setTitle] = useState('');
  const [templates, setTemplates] = useState<BarcodeLabelTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLabel, setGeneratedLabel] = useState<BarcodeLabel | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get<{ data: BarcodeLabelTemplate[] }>('/barcodes/templates', { params: { entityType: 'PRODUCT' } });
      setTemplates(res.data || []);
    } catch { setTemplates([]); } finally { setLoadingTemplates(false); }
  }, []);

  useMemo(() => { fetchTemplates(); }, []);

  const handleGenerate = async () => {
    if (!productId) { showToast(t('barcodes.designer.noProduct'), 'error'); return; }
    setGenerating(true);
    setGeneratedLabel(null);
    try {
      const res = await api.post<BarcodeLabel>('/barcodes/labels/generate', {
        entityType: 'PRODUCT',
        entityId: productId,
        ...(templateCode ? { labelTemplateCode: templateCode } : {}),
        ...(title ? { title } : {}),
      });
      setGeneratedLabel(res);
      showToast(t('barcodes.designer.generateSuccess'), 'success');
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); } finally { setGenerating(false); }
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

  useRegisterAdminActions([
    {
      id: 'generate', labelKey: 'barcodes.designer.generate',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: handleGenerate, enabled: !!productId,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.designer.productTitle')} subtitle={t('barcodes.designer.productSubtitle')} />
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup
              label={t('barcodes.designer.selectProduct')}
              value={productId}
              onChange={(v) => { setProductId(v); setGeneratedLabel(null); }}
              adapter={productAdapter}
              placeholder={t('barcodes.designer.productPlaceholder')}
            />
            <Select label={t('barcodes.designer.template')} value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              options={templates.map((tpl) => ({ value: tpl.code, label: `${tpl.name} (${tpl.symbology})` }))}
              placeholder={t('barcodes.designer.noTemplate')} />
            <Input label={t('barcodes.designer.title')} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t('barcodes.designer.titlePlaceholder')} />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleGenerate} loading={generating} disabled={!productId}>{t('barcodes.designer.generate')}</Button>
          </div>
        </CardContent>
      </Card>

      {loadingTemplates && <LoadingState message={t('common.loading')} />}

      {generatedLabel && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.designer.generatedLabel')}</h3></CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-gray-50 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">{t('barcodes.labelCode')}: {generatedLabel.code}</p>
                <p className="text-lg font-bold font-mono mb-2">{generatedLabel.value}</p>
                {generatedLabel.title && <p className="text-sm text-gray-700">{generatedLabel.title}</p>}
                <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
                  <span>{t('barcodes.symbology')}: {generatedLabel.symbology}</span>
                  <span>{t('barcodes.entityType')}: {generatedLabel.entityType}</span>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="secondary" onClick={() => handlePrint(generatedLabel)}>{t('barcodes.print.print')}</Button>
                  <Link href={`/admin/barcodes/product-labels/preview?labelId=${generatedLabel.id}`}>
                    <Button variant="secondary">{t('common.preview')}</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
