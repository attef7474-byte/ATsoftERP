'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, EmptyState, StatusBadge, Button, ConfirmDialog } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../../../components/admin/admin-action-bar';

interface WorkflowState {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  transitions: WorkflowTransition[];
  history: WorkflowHistoryEntry[];
}

interface WorkflowTransition {
  action: string;
  label: string;
  fromStatus: string;
  toStatus: string;
  variant?: 'primary' | 'danger';
}

interface WorkflowHistoryEntry {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  performedById?: string | null;
  performedBy?: { id: string; name: string } | null;
  notes?: string | null;
  createdAt: string;
}

export default function RequestWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<WorkflowState>(`/maintenance/requests/${id}/workflow`);
      setWorkflow(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execTransition = async () => {
    setTransitionLoading(true);
    try {
      await api.patch(`/maintenance/requests/${id}/${pendingAction}`, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setTransitionLoading(false); }
  };

  const requestTransition = (action: string) => {
    setPendingAction(action);
    setConfirmOpen(true);
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

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!workflow) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenanceWorkflow.currentStatus')}</h3></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{t('maintenance.request')}: {workflow.requestNumber} - {workflow.title}</span>
            <StatusBadge status={workflow.status} />
          </div>
        </CardContent>
      </Card>

      {workflow.transitions.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenanceWorkflow.availableTransitions')}</h3></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {workflow.transitions.map((tr) => (
                <Button key={tr.action} variant={tr.variant || 'primary'} onClick={() => requestTransition(tr.action)}>
                  {tr.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              {t('maintenanceWorkflow.transitionDescription')}: {workflow.transitions.map((tr) => `${tr.fromStatus} → ${tr.toStatus}`).join(', ')}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenanceWorkflow.transitionHistory')}</h3></CardHeader>
        <CardContent>
          {workflow.history.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-0">
                {workflow.history.map((entry) => (
                  <div key={entry.id} className="relative flex gap-4 py-3 pl-10">
                    <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-gray-100 border-2 border-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{entry.performedBy?.name || '-'}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{entry.action}</span>
                        <span className="text-xs text-gray-400">{fmt(entry.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {entry.fromStatus} <span className="text-gray-400">→</span> {entry.toStatus}
                        {entry.notes && <span className="text-gray-400 ml-2">- {entry.notes}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={execTransition}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={transitionLoading} />
    </div>
  );
}
