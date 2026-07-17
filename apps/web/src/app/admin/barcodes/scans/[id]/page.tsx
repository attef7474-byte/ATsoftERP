'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { BarcodeScanEvent } from '../../../../../lib/admin-types';

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const id = params.id as string;
  const [scan, setScan] = useState<BarcodeScanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchScan = useCallback(async () => {
    setLoading(true); setError('');
    try { setScan(await api.get<BarcodeScanEvent>(`/barcodes/scans/${id}`)); }
    catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchScan(); }, [fetchScan]);

  const { exec } = useStableHandlers({ back: () => router.push('/admin/barcodes/scans'), refresh: () => fetchScan() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchScan} />;
  if (!scan) return <ErrorState message={t('common.notFound')} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.scanDetail.title')} />

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.scanEventDetails')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><p className="text-sm text-gray-500">{t('barcodes.scannedValue')}</p><p className="font-mono font-medium">{scan.scannedValue}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.purpose')}</p><p>{scan.purpose}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.scanResult')}</p><StatusBadge status={scan.result} /></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.entityType')}</p><p>{scan.entityType || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.entityId')}</p><p>{scan.entityId || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.source')}</p><p>{scan.source || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.symbology')}</p><p>{scan.symbology || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.contextType')}</p><p>{scan.contextType || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.contextId')}</p><p>{scan.contextId || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.scannedAt')}</p><p>{scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : '-'}</p></div>
            {scan.message && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('common.message')}</p><p>{scan.message}</p></div>}
          </div>
        </CardContent>
      </Card>

      {scan.label && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.linkedLabel')}</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">{t('barcodes.labelCode')}</p><p>{scan.label.code}</p></div>
              <div><p className="text-sm text-gray-500">{t('barcodes.labelValue')}</p><p className="font-mono">{scan.label.value}</p></div>
              <div><p className="text-sm text-gray-500">{t('common.status')}</p><StatusBadge status={scan.label.status} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="secondary" onClick={() => router.push('/admin/barcodes/scans')}>{t('common.back')}</Button>
    </div>
  );
}
