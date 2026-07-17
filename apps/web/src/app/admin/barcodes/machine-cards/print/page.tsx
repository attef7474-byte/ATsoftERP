'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { machineAdapter } from '../../../../../components/f9/lookup-adapters';
import { BarcodeLabel } from '../../../../../lib/admin-types';

export default function MachineCardPrintPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [machineId, setMachineId] = useState('');
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);

  const selectedLabel = labels.find((l) => l.id === selectedLabelId);

  useEffect(() => {
    const lid = searchParams.get('labelId');
    if (lid) setSelectedLabelId(lid);
  }, []);

  const fetchLabels = useCallback(async (mid: string) => {
    if (!mid) { setLabels([]); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: BarcodeLabel[] }>(`/barcodes/entities/MACHINE/${mid}/labels`);
      setLabels(res.data || []);
    } catch { setLabels([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (machineId) fetchLabels(machineId);
    else setLabels([]);
  }, [machineId, fetchLabels]);

  const handlePrint = () => {
    const label = selectedLabel;
    if (!label) return;
    for (let i = 0; i < copies; i++) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>${label.code} - Copy ${i + 1}</title>
          <style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
          </head><body>
          <h2>${t('barcodes.print.title')}</h2>
          <p style="font-size:10px;color:#999;">${t('barcodes.print.copy')} ${i + 1}/${copies}</p>
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
    }
    showToast(t('barcodes.print.printSent'), 'success');
  };

  const { exec } = useStableHandlers({ print: () => handlePrint() });

  useRegisterAdminActions([
    { id: 'print', labelKey: 'barcodes.print.print', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>, onClick: () => exec('print'), enabled: !!selectedLabel },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.print.machineTitle')} subtitle={t('barcodes.print.machineSubtitle')} />
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup
              label={t('barcodes.print.selectMachine')}
              value={machineId}
              onChange={(v) => { setMachineId(v); setSelectedLabelId(''); }}
              adapter={machineAdapter}
              placeholder={t('barcodes.print.machinePlaceholder')}
            />
            <Select label={t('barcodes.print.selectLabel')} value={selectedLabelId}
              onChange={(e) => setSelectedLabelId(e.target.value)}
              options={labels.map((l) => ({ value: l.id, label: `[${l.code}] ${l.value}` }))}
              placeholder={t('barcodes.print.noLabels')} />
            <Input label={t('barcodes.print.copies')} type="number" min={1} max={100} value={String(copies)}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handlePrint} disabled={!selectedLabel}>{t('barcodes.print.print')}</Button>
          </div>
        </CardContent>
      </Card>

      {loading && <LoadingState message={t('common.loading')} />}

      {!loading && machineId && labels.length === 0 && (
        <EmptyState message={t('barcodes.print.noLabelsForMachine')} />
      )}

      {selectedLabel && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.print.preview')}</h3></CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-gray-50 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">{t('barcodes.labelCode')}: {selectedLabel.code}</p>
                <p className="text-lg font-bold font-mono mb-2">{selectedLabel.value}</p>
                {selectedLabel.title && <p className="text-sm text-gray-700">{selectedLabel.title}</p>}
                <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
                  <span>{t('barcodes.symbology')}: {selectedLabel.symbology}</span>
                  <span><StatusBadge status={selectedLabel.status} /></span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{t('barcodes.print.copies') + ': ' + copies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
