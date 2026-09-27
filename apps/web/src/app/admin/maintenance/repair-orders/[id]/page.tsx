'use client';
/**
 * R2-G — the repair-order detail workspace.
 *
 * Two rules shape this page:
 *
 * 1. The backend decides what may be done. On load (and after every mutation) the
 *    page refetches `/maintenance/repair-orders/:id` and
 *    `/maintenance/repair-orders/:id/workflow` and renders only the actions the
 *    workflow response published for the CURRENT status. There is no local
 *    transition table, no optimistic status write, and no hidden-then-refetched
 *    status: what is on screen is always what the server last said.
 *
 * 2. Permissions are a second, independent filter. The workflow answer says what
 *    the ORDER supports; the signed-in user's own permission set says what they
 *    may press. Both must agree, and the backend re-checks on the write, so a
 *    stale or forged UI cannot widen anything.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useAuth } from '../../../../../lib/auth-context';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import {
  useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon,
} from '../../../../../components/admin/admin-action-bar';
import {
  Button, Card, CardHeader, CardContent, DataTable, LoadingState, EmptyState,
  ErrorState, StatusBadge, Select, Input, Textarea, LocalizedValue, ConfirmDialog,
} from '../../../../../components/admin/ui';
import { formatDateTime } from '../../../../../lib/i18n/literals';
import { RepairOrderActionDialog } from '../repair-order-action-dialog';
import {
  EMPTY_REPAIR_FORM, RepairFormState, buildRepairPayload, repairActionDef,
  effectiveRepairPermissions, offerableRepairActions,
} from '../repair-order-actions';
import {
  RepairOrderDetail, RepairOrderAction, RepairWorkflow, WorkflowAction,
  REPAIR_ACTION_TYPES, REPAIR_ACTION_STATUSES, fetchRepairOrder, fetchRepairWorkflow,
  fetchRepairActions, submitWorkflowAction, createRepairAction,
} from '../repair-order-api';

type Tab = 'overview' | 'source' | 'history' | 'workflow';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'maintenance.repairTabOverview' },
  { key: 'source', labelKey: 'maintenance.repairTabSource' },
  { key: 'history', labelKey: 'maintenance.repairTabHistory' },
  { key: 'workflow', labelKey: 'maintenance.repairTabWorkflow' },
];

export default function RepairOrderDetailPage() {
  const { t, locale, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<RepairOrderDetail | null>(null);
  const [workflow, setWorkflow] = useState<RepairWorkflow | null>(null);
  const [actions, setActions] = useState<RepairOrderAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [form, setForm] = useState<RepairFormState>(EMPTY_REPAIR_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    actionType: 'NOTE', actionStatus: 'DONE', description: '', result: '', durationMinutes: '', notes: '',
  });
  const [noteError, setNoteError] = useState('');

  const can = useCallback(
    (permission: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(permission)),
    [isSuperAdmin, permissions],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      // Order and workflow are fetched together and both are refetched after every
      // mutation, so the rendered status and the offered actions can never come
      // from two different points in time.
      const [detail, flow, actionRows] = await Promise.all([
        fetchRepairOrder(id),
        fetchRepairWorkflow(id),
        fetchRepairActions(id),
      ]);
      setOrder(detail);
      setWorkflow(flow);
      setActions(actionRows);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) setNotFound(true);
      else setError((err as { message?: string })?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  const closeDialogs = useCallback(() => {
    setPendingAction(null);
    setActionError('');
    setFieldErrors({});
    setForm(EMPTY_REPAIR_FORM);
  }, []);

  const remaining = useMemo(
    () => Number(order?.remainingQuantity ?? order?.sourceQuantity ?? 0),
    [order],
  );

  /** The actions this user may actually press: backend-published AND permitted. */
  const offerable = useMemo<WorkflowAction[]>(() => {
    const granted = effectiveRepairPermissions(permissions?.permissions, isSuperAdmin);
    return workflow ? offerableRepairActions(workflow.actions, granted) : [];
  }, [workflow, permissions, isSuperAdmin]);

  const startAction = useCallback((action: WorkflowAction) => {
    setActionError('');
    setFieldErrors({});
    setForm({
      ...EMPTY_REPAIR_FORM,
      repairedQuantity: String(remaining),
      notRepairableQuantity: String(remaining),
      scrappedQuantity: String(remaining),
    });
    if (action.requiresInput) {
      setPendingAction(action);
      return;
    }
    // A no-input transition still goes through the same submit path, so the
    // payload builder and the post-mutation refetch stay identical for all of them.
    setPendingAction(action);
  }, [remaining]);

  const submitAction = useCallback(async () => {
    if (!pendingAction || !id) return;
    const def = repairActionDef(pendingAction.key);
    if (!def) return;
    const result = buildRepairPayload(pendingAction.key, form, remaining);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await submitWorkflowAction(id, pendingAction.route, result.payload);
      showToast(t('maintenance.repairOrderActionSucceeded'), 'success');
      closeDialogs();
      // Refetch: the server is the only source of the new status and balances.
      await load();
    } catch (err: unknown) {
      handleApiError(err);
      setActionError((err as { message?: string })?.message || t('errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  }, [pendingAction, id, form, remaining, showToast, t, closeDialogs, load, handleApiError]);

  const submitNote = useCallback(async () => {
    if (!id) return;
    if (!noteForm.description.trim() && !noteForm.notes.trim()) {
      setNoteError(t('validation.required'));
      return;
    }
    setSaving(true);
    setNoteError('');
    try {
      await createRepairAction(id, {
        actionType: noteForm.actionType,
        actionStatus: noteForm.actionStatus,
        description: noteForm.description.trim() || undefined,
        result: noteForm.result.trim() || undefined,
        durationMinutes: noteForm.durationMinutes ? Number(noteForm.durationMinutes) : undefined,
        notes: noteForm.notes.trim() || undefined,
      });
      showToast(t('maintenance.repairActionAdded'), 'success');
      setNoteOpen(false);
      setNoteForm({ actionType: 'NOTE', actionStatus: 'DONE', description: '', result: '', durationMinutes: '', notes: '' });
      await load();
    } catch (err: unknown) {
      handleApiError(err);
      setNoteError((err as { message?: string })?.message || t('errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  }, [id, noteForm, showToast, t, load, handleApiError]);

  const handlers = useMemo(() => ({
    refresh: () => load(),
    back: () => router.push('/admin/maintenance/repair-orders'),
  }), [load, router]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const actionColumns = useMemo(() => ([
    {
      key: 'actionType',
      header: t('maintenance.repairActionType'),
      render: (row: RepairOrderAction) => <LocalizedValue value={row.actionType} />,
    },
    {
      key: 'actionStatus',
      header: t('maintenance.repairActionStatus'),
      render: (row: RepairOrderAction) => <LocalizedValue value={row.actionStatus} />,
    },
    { key: 'description', header: t('maintenance.repairActionDescription'), render: (row: RepairOrderAction) => row.description || '-' },
    { key: 'result', header: t('maintenance.repairActionResult'), render: (row: RepairOrderAction) => row.result || '-' },
    { key: 'performedAt', header: t('maintenance.repairActionPerformedAt'), render: (row: RepairOrderAction) => formatDateTime(row.performedAt, locale) },
    { key: 'durationMinutes', header: t('maintenance.duration'), render: (row: RepairOrderAction) => row.durationMinutes ?? '-' },
  ]), [t, locale]);

  if (loading && !order) return <LoadingState message={t('common.loading')} />;
  if (notFound) {
    return <EmptyState message={t('maintenance.repairOrderNotFound')} action={<Button onClick={() => router.push('/admin/maintenance/repair-orders')}>{t('common.back')}</Button>} />;
  }
  if (error && !order) return <ErrorState message={error} onRetry={load} />;
  if (!order) return <ErrorState message={t('errors.loadFailed')} onRetry={load} />;

  const orderLabel = order.repairOrderNumber || order.id;
  const confirmedAction = pendingAction && !repairActionDef(pendingAction.key)?.needsInput ? pendingAction : null;

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="text-sm font-medium text-gray-900 mt-1 break-words">{value ?? '-'}</div>
    </div>
  );

  return (
    <div className="space-y-6" dir={dir}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{orderLabel}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('maintenance.sparePartLabel')}: {order.sparePart ? `[${order.sparePart.code}] ${order.sparePart.name}` : '-'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status} />
              {workflow?.isTerminal ? (
                <span className="text-xs text-gray-500">{t('maintenance.repairTerminalState')}</span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <ErrorState message={error} onRetry={load} /> : null}

          <div className="flex flex-wrap gap-2" data-testid="repair-workflow-actions">
            {offerable.length === 0 ? (
              <p className="text-sm text-gray-500">
                {workflow?.isTerminal
                  ? t('maintenance.repairTerminalNoActions')
                  : t('maintenance.repairNoAvailableActions')}
              </p>
            ) : null}
            {offerable.map((action) => {
              const def = repairActionDef(action.key);
              if (!def) return null;
              return (
                <Button
                  key={action.key}
                  size="sm"
                  variant={action.danger ? 'danger' : 'primary'}
                  data-action={action.key}
                  onClick={() => startAction(action)}
                >
                  {t(def.labelKey)}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6" dir={dir}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' ? (
        <Card>
          <CardHeader><h2 className="text-base font-semibold">{t('maintenance.repairTabOverview')}</h2></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label={t('common.status')} value={<StatusBadge status={order.status} />} />
              <Field label={t('maintenance.condition')} value={<LocalizedValue value={order.sourceCondition} />} />
              <Field label={t('maintenance.repairSourceQuantity')} value={order.sourceQuantity} />
              <Field label={t('maintenance.repairReservedQuantity')} value={order.reservedQuantity ?? 0} />
              <Field label={t('maintenance.repairedQuantity')} value={order.repairedQuantity ?? 0} />
              <Field label={t('maintenance.scrappedQuantity')} value={order.scrappedQuantity ?? 0} />
              <Field label={t('maintenance.repairRemainingQuantity')} value={remaining} />
              <Field label={t('maintenance.targetCondition')} value={order.targetCondition ? <LocalizedValue value={order.targetCondition} /> : '-'} />
              <Field label={t('maintenance.warehouse')} value={order.warehouse ? `[${order.warehouse.code}] ${order.warehouse.name}` : '-'} />
              <Field label={t('maintenance.machine')} value={order.machine ? `[${order.machine.code}] ${order.machine.name}` : '-'} />
              <Field label={t('maintenance.repairComponent')} value={order.machineComponent ? `[${order.machineComponent.code}] ${order.machineComponent.name}` : '-'} />
              <Field label={t('maintenance.repairRequest')} value={order.maintenanceRequest?.requestNumber || '-'} />
              <Field label={t('maintenance.repairEstimatedCost')} value={order.estimatedRepairCost != null ? Number(order.estimatedRepairCost).toLocaleString() : '-'} />
              <Field label={t('maintenance.repairActualCost')} value={order.actualRepairCost != null ? Number(order.actualRepairCost).toLocaleString() : '-'} />
              <Field label={t('maintenance.repairExternal')} value={order.externalRepair ? t('common.yes') : t('common.no')} />
              <Field label={t('maintenance.repairExternalProvider')} value={order.externalRepairProviderName || '-'} />
            </div>

            {order.failureDescription || order.repairDescription || order.inspectionResult
              || order.testResult || order.testNotes || order.notes || order.cancelReason ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {order.inspectionResult ? <Field label={t('maintenance.inspectionResult')} value={order.inspectionResult} /> : null}
                {order.failureDescription ? <Field label={t('maintenance.failureDescription')} value={order.failureDescription} /> : null}
                {order.repairDescription ? <Field label={t('maintenance.repairDescription')} value={order.repairDescription} /> : null}
                {order.testResult ? <Field label={t('maintenance.testResult')} value={order.testResult} /> : null}
                {order.testNotes ? <Field label={t('maintenance.repairTestNotes')} value={order.testNotes} /> : null}
                {order.cancelReason ? <Field label={t('maintenance.repairReason')} value={order.cancelReason} /> : null}
                {order.notes ? <Field label={t('maintenance.notes')} value={order.notes} /> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'source' ? (
        <Card>
          <CardHeader><h2 className="text-base font-semibold">{t('maintenance.repairTabSource')}</h2></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={t('maintenance.repairSourceType')} value={<LocalizedValue value={order.sourceType} />} />
              <Field label={t('maintenance.repairSourceId')} value={order.sourceId || '-'} />
              <Field label={t('maintenance.repairRequest')} value={order.maintenanceRequest?.requestNumber || '-'} />
              <Field label={t('maintenance.repairReplacementHistory')} value={order.replacementHistoryId || '-'} />
              <Field label={t('maintenance.repairInstalledPart')} value={order.installedPartId || '-'} />
              <Field label={t('maintenance.repairConditionInMovement')} value={order.conditionInMovementId || '-'} />
              <Field label={t('maintenance.repairConditionOutMovement')} value={order.conditionOutMovementId || '-'} />
              <Field label={t('maintenance.repairScrapMovement')} value={order.inventoryScrapMovementId || '-'} />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">{t('maintenance.repairTimeline')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={t('maintenance.repairOpenedAt')} value={formatDateTime(order.openedAt, locale)} />
              <Field label={t('maintenance.repairInspectionStartedAt')} value={formatDateTime(order.inspectionStartedAt, locale)} />
              <Field label={t('maintenance.repairStartedAt')} value={formatDateTime(order.repairStartedAt, locale)} />
              <Field label={t('maintenance.repairTestStartedAt')} value={formatDateTime(order.testStartedAt, locale)} />
              <Field label={t('maintenance.repairCompletedAt')} value={formatDateTime(order.completedAt, locale)} />
              <Field label={t('maintenance.repairCancelledAt')} value={formatDateTime(order.cancelledAt, locale)} />
              <Field label={t('maintenance.repairOpenedBy')} value={order.openedByUserId || '-'} />
              <Field label={t('maintenance.repairInspectedBy')} value={order.inspectedByUserId || '-'} />
              <Field label={t('maintenance.repairRepairedBy')} value={order.repairedByUserId || '-'} />
              <Field label={t('maintenance.repairTestedBy')} value={order.testedByUserId || '-'} />
              <Field label={t('maintenance.repairClosedBy')} value={order.closedByUserId || '-'} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'history' ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('maintenance.repairActions')}</h2>
              {can('repair-actions:create') && !workflow?.isTerminal ? (
                <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
                  {t('maintenance.repairAddAction')}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={actionColumns}
              data={actions}
              keyExtractor={(row: RepairOrderAction) => row.id}
              loading={loading}
              emptyMessage={t('common.noData')}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'workflow' ? (
        <Card>
          <CardHeader><h2 className="text-base font-semibold">{t('maintenance.repairTabWorkflow')}</h2></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              {t('maintenance.repairWorkflowCurrentStatus')}: <StatusBadge status={workflow?.status || order.status} />
            </p>
            {offerable.length === 0 ? (
              <EmptyState message={workflow?.isTerminal
                ? t('maintenance.repairTerminalNoActions')
                : t('maintenance.repairNoAvailableActions')} />
            ) : (
              <ul className="space-y-2" data-testid="repair-workflow-list">
                {offerable.map((action) => {
                  const def = repairActionDef(action.key);
                  return (
                    <li key={action.key} className="flex items-center justify-between gap-3 border border-gray-200 rounded p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{def ? t(def.labelKey) : action.key}</p>
                        <p className="text-xs text-gray-500">
                          {t('maintenance.repairWorkflowLeadsTo')}:{' '}
                          {action.targets.map((target) => (
                            <span key={target} className="mr-2"><StatusBadge status={target} /></span>
                          ))}
                        </p>
                      </div>
                      <Button size="sm" variant={action.danger ? 'danger' : 'primary'} onClick={() => startAction(action)}>
                        {def ? t(def.labelKey) : action.key}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* A transition with no evidence fields still confirms explicitly, so a
          one-click status change is always a deliberate operator decision. */}
      <ConfirmDialog
        open={!!confirmedAction}
        onClose={closeDialogs}
        loading={saving}
        variant={confirmedAction?.danger ? 'danger' : 'primary'}
        title={confirmedAction && repairActionDef(confirmedAction.key) ? t(repairActionDef(confirmedAction.key)!.labelKey) : ''}
        message={orderLabel}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={submitAction}
      >
        {actionError ? <div role="alert" className="text-sm text-red-700">{actionError}</div> : null}
      </ConfirmDialog>

      <RepairOrderActionDialog
        actionKey={pendingAction && pendingAction.requiresInput ? pendingAction.key : null}
        form={form}
        fieldErrors={fieldErrors}
        remaining={remaining}
        orderLabel={orderLabel}
        saving={saving}
        error={actionError}
        onChange={setForm}
        onSubmit={submitAction}
        onClose={closeDialogs}
      />

      {noteOpen ? (
        <Card>
          <CardHeader><h2 className="text-base font-semibold">{t('maintenance.repairAddAction')}</h2></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {noteError ? <div role="alert" className="text-sm text-red-700">{noteError}</div> : null}
              <Select
                label={t('maintenance.repairActionType')}
                name="repairActionType"
                required
                value={noteForm.actionType}
                onChange={(e) => setNoteForm({ ...noteForm, actionType: e.target.value })}
                options={REPAIR_ACTION_TYPES.map((type) => ({ value: type, label: t(`maintenance.repairActionType_${type}`) }))}
              />
              <Select
                label={t('maintenance.repairActionStatus')}
                name="repairActionStatus"
                value={noteForm.actionStatus}
                onChange={(e) => setNoteForm({ ...noteForm, actionStatus: e.target.value })}
                options={REPAIR_ACTION_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))}
              />
              <Textarea
                label={t('maintenance.repairActionDescription')}
                name="repairActionDescription"
                value={noteForm.description}
                onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
              />
              <Textarea
                label={t('maintenance.repairActionResult')}
                name="repairActionResult"
                value={noteForm.result}
                onChange={(e) => setNoteForm({ ...noteForm, result: e.target.value })}
              />
              <Input
                label={t('maintenance.duration')}
                name="durationMinutes"
                type="number"
                min="0"
                value={noteForm.durationMinutes}
                onChange={(e) => setNoteForm({ ...noteForm, durationMinutes: e.target.value })}
              />
              <Textarea
                label={t('maintenance.notes')}
                name="repairActionNotes"
                value={noteForm.notes}
                onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setNoteOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
                <Button onClick={submitNote} loading={saving}>{t('common.save')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
