'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import {
  LocalizedValue, PageHeader, StatusBadge, Modal, Input, Select, Textarea, Button, ConfirmDialog,
} from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import {
  useRegisterAdminActions, useStableHandlers, ActionRefreshIcon,
  ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionDeleteIcon,
} from '../../../../components/admin/admin-action-bar';
import { useAuth } from '../../../../lib/auth-context';
import { REPAIR_ACTIONS, RepairActionDef } from './repair-order-actions';

interface RepairOrder {
  id: string; repairOrderNumber?: string; status: string;
  sparePartId: string; sourceCondition: string; sourceQuantity: number;
  repairedQuantity: number; scrappedQuantity: number; remainingQuantity?: number;
  sparePart?: { id: string; code: string; name: string };
  warehouse?: { id: string; code: string; name: string };
  maintenanceRequest?: { id: string; requestNumber: string };
}

const ICONS: Record<RepairActionDef['icon'], React.ReactNode> = {
  start: <ActionStartIcon />,
  complete: <ActionCompleteIcon />,
  cancel: <ActionCancelIcon />,
  delete: <ActionDeleteIcon />,
};

interface FormState {
  outcome: string;
  inspectionResult: string;
  failureDescription: string;
  repairedQuantity: string;
  scrappedQuantity: string;
  notRepairableQuantity: string;
  targetCondition: string;
  reason: string;
}

const EMPTY_FORM: FormState = {
  outcome: 'REPAIRABLE',
  inspectionResult: '',
  failureDescription: '',
  repairedQuantity: '',
  scrappedQuantity: '',
  notRepairableQuantity: '',
  targetCondition: 'USED_SERVICEABLE',
  reason: '',
};

export default function RepairOrdersPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const [data, setData] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<RepairOrder | null>(null);
  const [formKey, setFormKey] = useState<string | null>(null);
  const [formOrder, setFormOrder] = useState<RepairOrder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const can = useCallback(
    (action: RepairActionDef['permission']) => isSuperAdmin || Boolean(permissions?.permissions.includes('repair-orders:' + action)),
    [isSuperAdmin, permissions],
  );

  const defFor = useCallback((key: string) => REPAIR_ACTIONS.find((def) => def.key === key), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<RepairOrder[]>('/maintenance/repair-orders', { params: { limit: 50 } });
      setData(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closeDialogs = useCallback(() => {
    setConfirmKey(null); setConfirmOrder(null);
    setFormKey(null); setFormOrder(null);
    setForm(EMPTY_FORM); setFormError('');
  }, []);

  const runAction = useCallback(async (
    order: RepairOrder,
    def: RepairActionDef,
    body?: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/maintenance/repair-orders/${order.id}/${def.route}`, body ?? {});
      setNotice(t('maintenance.repairOrderActionSucceeded'));
      await fetchData();
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t('errors.updateFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [fetchData, t]);

  const startAction = useCallback((order: RepairOrder, key: string) => {
    const def = defFor(key);
    if (!def) return;
    setError(''); setNotice(''); setFormError('');
    if (!def.needsInput) {
      setConfirmOrder(order); setConfirmKey(key);
      return;
    }
    const remaining = order.remainingQuantity ?? 0;
    setForm({ ...EMPTY_FORM, repairedQuantity: String(remaining), notRepairableQuantity: String(remaining) });
    setFormOrder(order); setFormKey(key);
  }, [defFor]);

  const submitForm = useCallback(async () => {
    if (!formOrder || !formKey) return;
    const def = defFor(formKey);
    if (!def) return;
    const require = (value: string) => {
      if (!value.trim()) { setFormError(t('validation.required')); return false; }
      return true;
    };
    let body: Record<string, unknown> = {};
    if (formKey === 'recordInspection') {
      if (!require(form.inspectionResult)) return;
      if (form.outcome === 'NOT_REPAIRABLE' && !require(form.failureDescription)) return;
      body = {
        outcome: form.outcome,
        inspectionResult: form.inspectionResult.trim(),
        failureDescription: form.failureDescription.trim() || undefined,
      };
    } else if (formKey === 'waitForParts') {
      if (!require(form.reason)) return;
      body = { reason: form.reason.trim() };
    } else if (formKey === 'completeServiceable') {
      if (form.repairedQuantity === '') { setFormError(t('validation.required')); return; }
      body = { repairedQuantity: Number(form.repairedQuantity), targetCondition: form.targetCondition };
    } else if (formKey === 'completePartial') {
      body = {
        repairedQuantity: Number(form.repairedQuantity || 0),
        scrappedQuantity: Number(form.scrappedQuantity || 0),
        targetCondition: form.targetCondition,
      };
    } else if (formKey === 'completeNotRepairable') {
      if (form.notRepairableQuantity === '' || !require(form.reason)) return;
      body = { notRepairableQuantity: Number(form.notRepairableQuantity), reason: form.reason.trim() };
    } else if (formKey === 'scrap') {
      if (form.scrappedQuantity === '') { setFormError(t('validation.required')); return; }
      body = { scrappedQuantity: Number(form.scrappedQuantity), reason: form.reason.trim() || undefined };
    } else if (formKey === 'cancel') {
      if (!require(form.reason)) return;
      body = { reason: form.reason.trim() };
    }
    const ok = await runAction(formOrder, def, body);
    if (ok) closeDialogs();
  }, [closeDialogs, defFor, form, formKey, formOrder, runAction, t]);

  const handlers = useMemo(() => ({ refresh: () => fetchData() }), [fetchData]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const gridActions = useMemo<GridAction<RepairOrder>[]>(() => REPAIR_ACTIONS.map((def) => ({
    label: t(def.labelKey),
    icon: ICONS[def.icon],
    variant: def.danger ? 'danger' : 'default',
    onClick: (order: RepairOrder) => startAction(order, def.key),
    enabled: (order: RepairOrder) => def.statuses.includes(order.status) && can(def.permission),
  })), [can, startAction, t]);

  const visibleData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data;
    return data.filter((order) => [
      order.repairOrderNumber,
      order.sparePart?.name,
      order.sparePart?.code,
      order.warehouse?.name,
      order.maintenanceRequest?.requestNumber,
      order.sourceCondition,
      order.status,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const columns = useMemo<GridColumn<RepairOrder>[]>(() => ([
    { key: 'repairOrderNumber', header: t('common.code'), render: (r: RepairOrder) => r.repairOrderNumber || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (r: RepairOrder) => r.sparePart?.name || '-' },
    { key: 'sourceCondition', header: t('maintenance.condition'), render: (r: RepairOrder) => <LocalizedValue value={r.sourceCondition} /> },
    { key: 'sourceQuantity', header: t('common.quantity'), render: (r: RepairOrder) => r.sourceQuantity },
    { key: 'repairedQuantity', header: t('maintenance.repairedQuantity'), render: (r: RepairOrder) => r.repairedQuantity || 0 },
    { key: 'status', header: t('common.status'), render: (r: RepairOrder) => <StatusBadge status={r.status} /> },
  ]), [t]);

  const confirmDef = confirmKey ? defFor(confirmKey) : undefined;
  const formDef = formKey ? defFor(formKey) : undefined;

  const targetConditionOptions = useMemo(() => ([
    { value: 'USED_SERVICEABLE', label: t('maintenance.conditionUsedServiceable') },
    { value: 'USED_REPAIRABLE', label: t('maintenance.conditionUsedRepairable') },
  ]), [t]);

  return (
    <div>
      <PageHeader title={t('maintenance.repairOrders')} />
      {notice ? <div className="mb-3 text-sm text-green-700" role="status">{notice}</div> : null}
      <AdminDataGrid
        columns={columns}
        data={visibleData}
        keyExtractor={(r: RepairOrder) => r.id}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={fetchData}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={fetchData}
        refreshLoading={loading}
        actions={gridActions}
      />

      <ConfirmDialog
        open={!!confirmDef}
        onClose={closeDialogs}
        loading={busy}
        variant={confirmDef?.danger ? 'danger' : 'primary'}
        title={confirmDef ? t(confirmDef.labelKey) : ''}
        message={confirmOrder?.repairOrderNumber || confirmOrder?.id || ''}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          if (!confirmOrder || !confirmDef) return;
          const ok = await runAction(confirmOrder, confirmDef);
          if (ok) closeDialogs();
        }}
      />

      <Modal open={!!formDef} onClose={closeDialogs} title={formDef ? t(formDef.labelKey) : ''}>
        <div className="space-y-4">
          {formKey === 'recordInspection' ? (
            <>
              <Select
                label={t('maintenance.inspectionOutcome')} name="outcome" required
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                options={[
                  { value: 'REPAIRABLE', label: t('maintenance.inspectionRepairable') },
                  { value: 'NOT_REPAIRABLE', label: t('maintenance.inspectionNotRepairable') },
                ]}
              />
              <Input
                label={t('maintenance.inspectionResult')} name="inspectionResult" required
                value={form.inspectionResult}
                onChange={(e) => setForm({ ...form, inspectionResult: e.target.value })}
              />
              {form.outcome === 'NOT_REPAIRABLE' ? (
                <Textarea
                  label={t('maintenance.failureDescription')} name="failureDescription" required
                  value={form.failureDescription}
                  onChange={(e) => setForm({ ...form, failureDescription: e.target.value })}
                />
              ) : null}
            </>
          ) : null}

          {formKey === 'waitForParts' || formKey === 'cancel' || formKey === 'completeNotRepairable' ? (
            <Textarea
              label={t('maintenance.repairReason')} name="reason" required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          ) : null}

          {formKey === 'completeServiceable' || formKey === 'completePartial' ? (
            <>
              <Input
                label={t('maintenance.repairedQuantity')} name="repairedQuantity" type="number" required={formKey === 'completeServiceable'}
                value={form.repairedQuantity}
                onChange={(e) => setForm({ ...form, repairedQuantity: e.target.value })}
              />
              {formKey === 'completePartial' ? (
                <Input
                  label={t('maintenance.scrappedQuantity')} name="scrappedQuantity" type="number"
                  value={form.scrappedQuantity}
                  onChange={(e) => setForm({ ...form, scrappedQuantity: e.target.value })}
                />
              ) : null}
              <Select
                label={t('maintenance.targetCondition')} name="targetCondition" required
                value={form.targetCondition}
                onChange={(e) => setForm({ ...form, targetCondition: e.target.value })}
                options={targetConditionOptions}
              />
            </>
          ) : null}

          {formKey === 'completeNotRepairable' ? (
            <Input
              label={t('maintenance.notRepairableQuantity')} name="notRepairableQuantity" type="number" required
              value={form.notRepairableQuantity}
              onChange={(e) => setForm({ ...form, notRepairableQuantity: e.target.value })}
            />
          ) : null}

          {formKey === 'scrap' ? (
            <>
              <Input
                label={t('maintenance.scrappedQuantity')} name="scrappedQuantity" type="number" required
                value={form.scrappedQuantity}
                onChange={(e) => setForm({ ...form, scrappedQuantity: e.target.value })}
              />
              <Textarea
                label={t('maintenance.repairReason')} name="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </>
          ) : null}

          {formError ? <div className="text-sm text-red-600" role="alert">{formError}</div> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialogs} disabled={busy}>{t('common.cancel')}</Button>
            <Button onClick={submitForm} loading={busy} disabled={busy}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
