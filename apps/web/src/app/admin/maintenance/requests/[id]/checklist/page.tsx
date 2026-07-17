'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceChecklistExecution, MaintenanceChecklistExecutionItem } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, EmptyState, StatusBadge, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';
import { F9Lookup, maintenanceScheduleAdapter } from '../../../../../../components/f9';

export default function RequestChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [executions, setExecutions] = useState<MaintenanceChecklistExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<MaintenanceChecklistExecution | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceChecklistExecution[]>(`/maintenance/requests/${id}/checklist`);
      setExecutions(res || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!scheduleId) { showToast(t('validation.required'), 'error'); return; }
    setCreating(true);
    try {
      await api.post(`/maintenance/requests/${id}/checklist`, { scheduleId });
      showToast(t('common.successCreated'), 'success');
      setScheduleId('');
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally { setCreating(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const executionColumns = [
    { key: 'schedule', header: t('maintenance.schedule'), render: (e: MaintenanceChecklistExecution) => e.schedule?.title || '-' },
    { key: 'status', header: t('common.status'), render: (e: MaintenanceChecklistExecution) => <StatusBadge status={e.status} /> },
    { key: 'startedAt', header: t('maintenance.startedAt'), render: (e: MaintenanceChecklistExecution) => fmt(e.startedAt) },
    { key: 'completedAt', header: t('maintenance.completedAt'), render: (e: MaintenanceChecklistExecution) => fmt(e.completedAt) },
    { key: 'completedBy', header: t('maintenance.completedBy'), render: (e: MaintenanceChecklistExecution) => e.completedBy?.name || '-' },
    { key: 'items', header: t('maintenance.items'), render: (e: MaintenanceChecklistExecution) => e._count?.items ?? '-' },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.createChecklistExecution')}</h3></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <F9Lookup label={t('maintenance.schedule')} value={scheduleId} onChange={setScheduleId} adapter={maintenanceScheduleAdapter} />
            </div>
            <Button onClick={handleCreate} loading={creating} disabled={!scheduleId}>{t('common.create')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.checklistExecutions')}</h3></CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <DataTable columns={executionColumns} data={executions} keyExtractor={(e: MaintenanceChecklistExecution) => e.id}
              onRowClick={(e: MaintenanceChecklistExecution) => setSelectedExecution(selectedExecution?.id === e.id ? null : e)} />
          )}
          {selectedExecution && selectedExecution.items && selectedExecution.items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">{t('maintenance.checklistItems')}</h4>
              <div className="space-y-2">
                {selectedExecution.items.map((item: MaintenanceChecklistExecutionItem) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div>
                      <span className="font-medium">{item.checklistItem?.title || '-'}</span>
                      {item.notes && <span className="text-gray-500 ml-2">- {item.notes}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.passed != null && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.passed ? t('common.passed') : t('common.failed')}
                        </span>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
