'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceChecklistExecution, MaintenanceChecklistExecutionItem, MaintenanceSchedule } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon } from '../../../../../../components/admin/admin-action-bar';

export default function ChecklistExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const scheduleId = params.id as string;
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [execution, setExecution] = useState<MaintenanceChecklistExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const schRes = await api.get<MaintenanceSchedule>(`/maintenance/schedules/${scheduleId}`);
      setSchedule(schRes);
      const execRes = await api.get<MaintenanceChecklistExecution[]>(`/maintenance/checklist-executions`, { params: { scheduleId } });
      const execs = Array.isArray(execRes) ? execRes : [];
      const activeExec = execs.find((e: MaintenanceChecklistExecution) => e.status === 'IN_PROGRESS');
      const completedExec = execs.find((e: MaintenanceChecklistExecution) => e.status === 'COMPLETED');
      if (activeExec) {
        const detail = await api.get<MaintenanceChecklistExecution>(`/maintenance/checklist-executions/${activeExec.id}`);
        setExecution(detail);
      } else if (completedExec) {
        const detail = await api.get<MaintenanceChecklistExecution>(`/maintenance/checklist-executions/${completedExec.id}`);
        setExecution(detail);
      }
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [scheduleId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startChecklist = async () => {
    setActionLoading(true);
    try {
      const exec = await api.post<MaintenanceChecklistExecution>('/maintenance/checklist-executions', { scheduleId });
      const detail = await api.get<MaintenanceChecklistExecution>(`/maintenance/checklist-executions/${exec.id}`);
      setExecution(detail);
      showToast(t('maintenanceWorkflow.checklistStarted'), 'success');
    } catch (err: any) { showToast(err?.message || t('errors.saveFailed'), 'error'); }
    finally { setActionLoading(false); }
  };

  const completeChecklist = async () => {
    if (!execution) return;
    setActionLoading(true);
    try {
      await api.patch(`/maintenance/checklist-executions/${execution.id}/complete`, {});
      showToast(t('maintenanceWorkflow.checklistCompleted'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setActionLoading(false); }
  };

  const updateItem = async (itemId: string, passed: boolean) => {
    if (!execution) return;
    try {
      await api.patch(`/maintenance/checklist-executions/${execution.id}/items/${itemId}`, { passed, status: passed ? 'COMPLETED' : 'FAILED' });
      showToast(t('maintenanceWorkflow.checklistItemUpdated'), 'success');
      const detail = await api.get<MaintenanceChecklistExecution>(`/maintenance/checklist-executions/${execution.id}`);
      setExecution(detail);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    start: () => startChecklist(),
    complete: () => completeChecklist(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'maintenanceWorkflow.startChecklist', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !execution || execution.status === 'COMPLETED' },
    { id: 'complete', labelKey: 'maintenanceWorkflow.completeChecklist', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(execution && execution.status === 'IN_PROGRESS') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.checklistExecution')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">{t('maintenanceWorkflow.checklistExecutionDescription')}</p>

          {schedule && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm"><span className="font-medium">{t('maintenance.maintenanceSchedule')}:</span> {schedule.title}</p>
              <p className="text-sm"><span className="font-medium">{t('common.status')}:</span> {schedule.status}</p>
            </div>
          )}

          {!execution && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">{t('common.noData')}</p>
              <Button onClick={startChecklist} loading={actionLoading}>{t('maintenanceWorkflow.startChecklist')}</Button>
            </div>
          )}

          {execution && execution.items && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{t('common.status')}:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${execution.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{execution.status}</span>
              </div>

              {execution.items.map((item: MaintenanceChecklistExecutionItem) => (
                <div key={item.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.checklistItem?.title || item.checklistItemId}</p>
                    {item.checklistItem?.description && <p className="text-xs text-gray-500">{item.checklistItem.description}</p>}
                    {item.passed !== null && item.passed !== undefined && (
                      <p className={`text-xs mt-1 ${item.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {item.passed ? t('maintenanceWorkflow.checklistItemPassed') : t('maintenanceWorkflow.checklistItemFailed')}
                      </p>
                    )}
                  </div>
                  {execution.status === 'IN_PROGRESS' && (
                    <div className="flex gap-2">
                      <button onClick={() => updateItem(item.id, true)} className={`px-3 py-1 text-xs rounded ${item.passed === true ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-gray-100 text-gray-600 hover:bg-green-50'}`}>{t('maintenanceWorkflow.checklistItemPassed')}</button>
                      <button onClick={() => updateItem(item.id, false)} className={`px-3 py-1 text-xs rounded ${item.passed === false ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-gray-100 text-gray-600 hover:bg-red-50'}`}>{t('maintenanceWorkflow.checklistItemFailed')}</button>
                    </div>
                  )}
                  {(execution.status === 'COMPLETED' && item.passed !== null && item.passed !== undefined) && (
                    <span className={`px-3 py-1 text-xs rounded ${item.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.passed ? t('maintenanceWorkflow.checklistItemPassed') : t('maintenanceWorkflow.checklistItemFailed')}
                    </span>
                  )}
                </div>
              ))}

              {execution.status === 'IN_PROGRESS' && (
                <div className="pt-4 text-center">
                  <Button onClick={completeChecklist} loading={actionLoading}>{t('maintenanceWorkflow.completeChecklist')}</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
