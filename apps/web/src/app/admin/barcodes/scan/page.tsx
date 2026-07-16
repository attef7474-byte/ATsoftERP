'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, CardContent, CardHeader, PageHeader, LoadingState, EmptyState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../components/admin/admin-action-bar';
import { BarcodeScanEvent, BarcodeScanResponse } from '../../../../lib/admin-types';

const PURPOSES = [
  { value: 'GENERAL_LOOKUP', labelKey: 'barcodes.scan.generalLookup' },
  { value: 'INVENTORY_COUNTING', labelKey: 'barcodes.scan.inventoryCounting' },
  { value: 'MAINTENANCE_LOOKUP', labelKey: 'barcodes.scan.maintenanceLookup' },
  { value: 'MACHINE_CHECK', labelKey: 'barcodes.scan.machineCheck' },
  { value: 'PART_LOOKUP', labelKey: 'barcodes.scan.partLookup' },
];

export default function BarcodeScanPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [scanValue, setScanValue] = useState('');
  const [purpose, setPurpose] = useState('GENERAL_LOOKUP');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BarcodeScanResponse | null>(null);
  const [scanError, setScanError] = useState('');
  const [scans, setScans] = useState<BarcodeScanEvent[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);

  const fetchScans = useCallback(async () => {
    setLoadingScans(true);
    try {
      const res = await api.get<{ data: BarcodeScanEvent[]; meta: any }>('/barcodes/scans', { params: { limit: '20' } });
      setScans(res.data || []);
    } catch { setScans([]); } finally { setLoadingScans(false); }
  }, []);

  useEffect(() => { fetchScans(); }, []);
  useEffect(() => { scanInputRef.current?.focus(); }, []);

  const handleScan = useCallback(async () => {
    if (!scanValue.trim()) return;
    setScanning(true); setScanResult(null); setScanError('');
    try {
      const result = await api.post<BarcodeScanResponse>('/barcodes/scan', { value: scanValue.trim(), purpose });
      setScanResult(result);
      fetchScans();
    } catch (err: any) {
      setScanError(err?.message || t('barcodes.scan.error'));
      showToast(err?.message || t('barcodes.scan.error'), 'error');
    } finally { setScanning(false); }
  }, [scanValue, purpose, t, showToast, fetchScans]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  const handleClear = () => {
    setScanValue(''); setScanResult(null); setScanError('');
    scanInputRef.current?.focus();
  };

  const getEntityLink = (result: BarcodeScanResponse): { href: string; label: string } | null => {
    const entityType = result.label?.entityType || '';
    let entityId = '';
    if (result.entity && typeof result.entity === 'object') {
      const e = result.entity as Record<string, unknown>;
      entityId = String(e?.id || '');
    }
    if (!entityType || !entityId) return null;
    if (!entityId) return null;
    switch (entityType) {
      case 'MACHINE': return { href: `/admin/maintenance/machines`, label: t('barcodes.entityQuickLinks.viewMachine') };
      case 'PRODUCT': return { href: `/admin/inventory/products`, label: t('barcodes.entityQuickLinks.viewProduct') };
      case 'MACHINE_PART': return { href: `/admin/maintenance/machine-parts`, label: t('barcodes.entityQuickLinks.viewPart') };
      case 'WAREHOUSE': return { href: `/admin/inventory/warehouses`, label: t('barcodes.entityQuickLinks.viewWarehouse') };
      case 'WAREHOUSE_LOCATION': return { href: `/admin/inventory/locations`, label: t('barcodes.entityQuickLinks.viewLocation') };
      case 'INVENTORY_COUNT': return { href: `/admin/inventory/counts/${entityId}`, label: t('barcodes.entityQuickLinks.viewCount') };
      case 'MAINTENANCE_REQUEST': return { href: `/admin/maintenance/requests/${entityId}`, label: t('barcodes.entityQuickLinks.viewRequest') };
      case 'MAINTENANCE_TASK': return { href: `/admin/maintenance/tasks`, label: t('barcodes.entityQuickLinks.viewTask') };
      default: return null;
    }
  };

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: fetchScans,
    },
    {
      id: 'scanAction', labelKey: 'barcodes.scan.scan',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
      onClick: handleScan, enabled: !!scanValue.trim(),
    },
    {
      id: 'clear', labelKey: 'barcodes.scan.clear',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      onClick: handleClear,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.scan.title')} />

      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <input ref={scanInputRef} type="text" value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('barcodes.scan.scanInput')}
                className="block w-full rounded-lg border-2 border-blue-400 px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus />
            </div>
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}
              options={PURPOSES.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
              className="w-48" />
            <Button onClick={handleScan} loading={scanning} disabled={!scanValue.trim()}>{t('barcodes.scan.scan')}</Button>
            <Button variant="secondary" onClick={handleClear}>{t('barcodes.scan.clear')}</Button>
          </div>
        </CardContent>
      </Card>

      {scanning && <div className="text-center py-4"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /><p className="mt-2 text-sm text-gray-500">{t('barcodes.scan.scanning')}</p></div>}

      {scanResult && (
        <Card>
          <CardHeader>
            <h3 className={`text-lg font-semibold ${scanResult.result === 'SUCCESS' ? 'text-green-700' : 'text-yellow-700'}`}>
              {scanResult.result === 'SUCCESS' ? t('barcodes.scan.success') : scanResult.message || t('barcodes.labelNotFound')}
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">{t('barcodes.scannedValue')}</p>
                <p className="font-mono font-bold">{scanResult.label?.value || scanValue}</p>
              </div>
              {scanResult.label && (
                <>
                  <div><p className="text-sm text-gray-500">{t('barcodes.labelCode')}</p><p>{scanResult.label.code}</p></div>
                  <div><p className="text-sm text-gray-500">{t('barcodes.entityType')}</p><p>{scanResult.label.entityType}</p></div>
                  <div><p className="text-sm text-gray-500">{t('barcodes.symbology')}</p><p>{scanResult.label.symbology || '-'}</p></div>
                  <div><p className="text-sm text-gray-500">{t('common.status')}</p><StatusBadge status={scanResult.label.status} /></div>
                  {scanResult.label.title && <div><p className="text-sm text-gray-500">{t('barcodes.generate.labelTitle')}</p><p>{scanResult.label.title}</p></div>}
                </>
              )}
              {scanResult.message && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('common.description')}</p><p>{scanResult.message}</p></div>}
            </div>
            {scanResult.entity && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('barcodes.entityDetails')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(scanResult.entity as Record<string, unknown>).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-gray-500">{key}: </span>
                      <span className="text-gray-900">{String(val ?? '-')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {scanResult.suggestedActions && scanResult.suggestedActions.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('barcodes.suggestedActions')}</p>
                <ul className="list-disc list-inside text-sm text-blue-600 space-y-1">
                  {scanResult.suggestedActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            {getEntityLink(scanResult) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('barcodes.entityQuickLinks.title')}</p>
                <Link href={getEntityLink(scanResult)!.href} className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium underline">
                  {getEntityLink(scanResult)!.label}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scanError && (
        <Card>
          <CardContent>
            <p className="text-red-600 font-medium">{scanError}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.scan.recentScans')}</h3></CardHeader>
        <CardContent className="p-0">
          {loadingScans && <LoadingState />}
          {!loadingScans && scans.length === 0 && <EmptyState message={t('barcodes.scan.noScans')} />}
          {!loadingScans && scans.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scanResult')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.purpose')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.scannedAt')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scans.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">{s.scannedValue}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.result} /></td>
                      <td className="px-4 py-3 text-sm">{s.purpose}</td>
                      <td className="px-4 py-3 text-sm">{s.entityType || '-'}</td>
                      <td className="px-4 py-3 text-sm">{s.scannedAt ? new Date(s.scannedAt).toLocaleString() : '-'}</td>
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
