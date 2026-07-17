'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';
import { BarcodePrintJob } from '../../../../../lib/admin-types';

export default function PrintJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [job, setJob] = useState<BarcodePrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true); setError('');
    try { setJob(await api.get<BarcodePrintJob>(`/barcodes/print-jobs/${id}`)); }
    catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleCancel = async () => {
    if (!job) return;
    setCancelling(true);
    try {
      await api.patch(`/barcodes/print-jobs/${job.id}/status`, { status: 'CANCELLED' });
      showToast(t('common.successUpdated'), 'success');
      setShowCancelConfirm(false);
      fetchJob();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setCancelling(false); }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PRINTING': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/barcodes/print-jobs'),
    refresh: () => fetchJob(),
    cancel: () => setShowCancelConfirm(true),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: job?.status === 'PENDING' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchJob} />;
  if (!job) return <ErrorState message={t('common.notFound')} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.printJobDetail.title')} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('barcodes.printJobDetails')}</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor(job.status)}`}>{job.status}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><p className="text-sm text-gray-500">{t('barcodes.jobType')}</p><p>{job.jobType}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.entityType')}</p><p>{job.entityType || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.entityId')}</p><p>{job.entityId || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.copies')}</p><p>{job.copies}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.printer')}</p><p>{job.printerName || '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.requestedAt')}</p><p>{job.requestedAt ? new Date(job.requestedAt).toLocaleString() : '-'}</p></div>
            <div><p className="text-sm text-gray-500">{t('barcodes.completedAt')}</p><p>{job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}</p></div>
            {job.note && <div className="md:col-span-2"><p className="text-sm text-gray-500">{t('common.note')}</p><p>{job.note}</p></div>}
          </div>
        </CardContent>
      </Card>

      {job.status === 'PENDING' && (
        <Button variant="danger" onClick={() => setShowCancelConfirm(true)} loading={cancelling}>
          {t('common.cancel')}
        </Button>
      )}

      <Button variant="secondary" onClick={() => router.push('/admin/barcodes/print-jobs')}>{t('common.back')}</Button>

      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title={t('barcodes.printJobs.cancelConfirmTitle')}
        message={t('barcodes.printJobs.cancelConfirmMessage')}
        confirmLabel={t('common.cancel')}
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
}
