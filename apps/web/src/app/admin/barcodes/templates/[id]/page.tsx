'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, EmptyState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../../components/admin/admin-action-bar';
import { BarcodeLabelTemplate } from '../../../../../lib/admin-types';

export default function BarcodeTemplateDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<BarcodeLabelTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toggling, setToggling] = useState(false);

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

  const handleToggleStatus = async () => {
    if (!template) return;
    setToggling(true);
    try {
      const action = template.status === 'ACTIVE' ? 'deactivate' : 'activate';
      await api.patch(`/barcodes/templates/${id}/${action}`);
      showToast(t('common.successUpdated'), 'success');
      fetchTemplate();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/barcodes/templates/${id}`);
      showToast(t('common.successDeleted'), 'success');
      router.push('/admin/barcodes/templates');
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  useRegisterAdminActions([
    {
      id: 'edit', labelKey: 'common.edit',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      onClick: () => router.push(`/admin/barcodes/templates/${id}/edit`), enabled: !!template,
    },
    {
      id: 'preview', labelKey: 'barcodes.templates.preview',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      onClick: () => router.push(`/admin/barcodes/templates/${id}/preview`), enabled: !!template,
    },
    {
      id: 'delete', labelKey: 'common.delete',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      onClick: () => setShowDeleteConfirm(true), enabled: !!template,
    },
    {
      id: 'back', labelKey: 'common.back',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
      onClick: () => router.push('/admin/barcodes/templates'),
    },
  ]);

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={fetchTemplate} />;
  if (!template) return <EmptyState message={t('common.notFound')} />;

  const details = [
    { label: t('barcodes.templateCode'), value: template.code },
    { label: t('common.name'), value: template.name },
    { label: t('common.description'), value: template.description || '-' },
    { label: t('barcodes.symbology'), value: template.symbology },
    { label: t('barcodes.entityType'), value: template.entityType || '-' },
    { label: `${t('barcodes.widthMm')} (mm)`, value: template.widthMm != null ? String(template.widthMm) : '-' },
    { label: `${t('barcodes.heightMm')} (mm)`, value: template.heightMm != null ? String(template.heightMm) : '-' },
    { label: t('common.status'), value: <StatusBadge status={template.status} /> },
    { label: t('common.createdAt'), value: new Date(template.createdAt).toLocaleString() },
    { label: t('common.updatedAt'), value: new Date(template.updatedAt).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={template.name} actions={
        <Button variant="secondary" onClick={() => router.push('/admin/barcodes/templates')}>{t('common.back')}</Button>
      } />
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.templates.details')}</h3></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="text-sm font-medium text-gray-500">{d.label}</dt>
                <dd className="mt-1 text-sm text-gray-900">{d.value}</dd>
              </div>
            ))}
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

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.push(`/admin/barcodes/templates/${id}/edit`)}>{t('common.edit')}</Button>
        <Button onClick={() => router.push(`/admin/barcodes/templates/${id}/preview`)} variant="secondary">{t('barcodes.templates.preview')}</Button>
        <Button onClick={handleToggleStatus} variant="secondary" loading={toggling}>
          {template.status === 'ACTIVE' ? t('barcodes.deactivate') : t('barcodes.activate')}
        </Button>
        <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>{t('common.delete')}</Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('barcodes.templates.deleteConfirmTitle')}
        message={t('barcodes.templates.deleteConfirmMessage')}
        loading={deleting}
      />
    </div>
  );
}
