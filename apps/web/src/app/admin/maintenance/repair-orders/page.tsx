'use client';
/**
 * R2-G — the repair-order list.
 *
 * Availability comes from the backend: every row carries
 * `availableActionKeys`, computed server-side from the same workflow table the
 * detail page's `/workflow` endpoint reads, so the grid offers exactly what the
 * API would accept and never has to re-derive the lifecycle in the browser. The
 * caller's own permissions narrow that further.
 *
 * The grid itself is a read-and-navigate surface: it filters, it opens the detail
 * workspace, and it jumps to the repairable queue. The evidence forms live in the
 * dialog component shared with the detail page, so both surfaces build identical
 * request bodies.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useAuth } from '../../../../lib/auth-context';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { LocalizedValue, PageHeader, StatusBadge, Button } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import {
  useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionViewIcon,
} from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, sparePartAdapter, warehouseAdapter } from '../../../../components/f9';
import { RepairOrderActionDialog } from './repair-order-action-dialog';
import {
  EMPTY_REPAIR_FORM, RepairFormState, buildRepairPayload, repairActionDef, REPAIR_ACTIONS,
  canRunRepairAction, effectiveRepairPermissions,
} from './repair-order-actions';
import {
  RepairOrderSummary, REPAIR_STATUS_OPTIONS, REPAIR_SOURCE_CONDITIONS,
  fetchRepairOrders, submitWorkflowAction,
} from './repair-order-api';

const PAGE_SIZE = 50;

export default function RepairOrdersPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<RepairOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Real backend filters — no client-side pre-filtering masquerading as a filter.
  const [status, setStatus] = useState('');
  const [sourceCondition, setSourceCondition] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [sparePartId, setSparePartId] = useState('');
  const [machineId, setMachineId] = useState('');

  const [form, setForm] = useState<RepairFormState>(EMPTY_REPAIR_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ order: RepairOrderSummary; actionKey: string } | null>(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const can = useCallback(
    (permission: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(permission)),
    [isSuperAdmin, permissions],
  );

  /**
   * The seeded set lifecycle actions are checked against. A super administrator
   * is never filtered by the seeded list, so the grant is widened explicitly
   * rather than relying on the API echoing every permission back.
   */
  const repairPermissions = useMemo(
    () => effectiveRepairPermissions(permissions?.permissions, isSuperAdmin),
    [permissions, isSuperAdmin],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchRepairOrders({
        status: status || undefined,
        sourceCondition: sourceCondition || undefined,
        warehouseId: warehouseId || undefined,
        sparePartId: sparePartId || undefined,
        machineId: machineId || undefined,
        limit: PAGE_SIZE,
      }));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [status, sourceCondition, warehouseId, sparePartId, machineId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closeDialogs = useCallback(() => {
    setPending(null);
    setActionError('');
    setFieldErrors({});
    setForm(EMPTY_REPAIR_FORM);
  }, []);

  const openDetail = useCallback((order: RepairOrderSummary) => {
    router.push(`/admin/maintenance/repair-orders/${order.id}`);
  }, [router]);

  const startAction = useCallback((order: RepairOrderSummary, actionKey: string) => {
    setActionError('');
    setFieldErrors({});
    const remaining = Number(order.remainingQuantity ?? order.sourceQuantity ?? 0);
    setForm({
      ...EMPTY_REPAIR_FORM,
      repairedQuantity: String(remaining),
      notRepairableQuantity: String(remaining),
      scrappedQuantity: String(remaining),
    });
    setPending({ order, actionKey });
  }, []);

  const submitAction = useCallback(async () => {
    if (!pending) return;
    const def = repairActionDef(pending.actionKey);
    if (!def) return;
    const remaining = Number(pending.order.remainingQuantity ?? pending.order.sourceQuantity ?? 0);
    const result = buildRepairPayload(pending.actionKey, form, remaining);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await submitWorkflowAction(pending.order.id, def.route, result.payload);
      showToast(t('maintenance.repairOrderActionSucceeded'), 'success');
      closeDialogs();
      // Re-read the list so quantities and statuses come back from the server.
      await fetchData();
    } catch (err: unknown) {
      handleApiError(err);
      setActionError((err as { message?: string })?.message || t('errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  }, [pending, form, showToast, t, closeDialogs, fetchData, handleApiError]);

  const handlers = useMemo(() => ({
    refresh: () => fetchData(),
    queue: () => router.push('/admin/maintenance/repair-orders/queue'),
  }), [fetchData, router]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const clearFilters = useCallback(() => {
    setStatus('');
    setSourceCondition('');
    setWarehouseId('');
    setSparePartId('');
    setMachineId('');
  }, []);

  const hasFilters = Boolean(status || sourceCondition || warehouseId || sparePartId || machineId);

  /**
   * Only the actions the backend published for that row AND the signed-in user is
   * permitted to press. An action the server did not offer cannot appear here.
   */
  const gridActions = useMemo<GridAction<RepairOrderSummary>[]>(() => {
    const result: GridAction<RepairOrderSummary>[] = [{
      label: t('common.view'),
      icon: <ActionViewIcon />,
      onClick: openDetail,
      enabled: () => true,
    }];
    for (const def of REPAIR_ACTIONS) {
      result.push({
        label: t(def.labelKey),
        variant: def.danger ? 'danger' : 'default',
        onClick: (order: RepairOrderSummary) => startAction(order, def.key),
        enabled: (order: RepairOrderSummary) =>
          (order.availableActionKeys || []).includes(def.key) && canRunRepairAction(repairPermissions, def),
      });
    }
    return result;
  }, [openDetail, repairPermissions, startAction, t]);

  const visibleData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data;
    return data.filter((order) => [
      order.repairOrderNumber,
      order.sparePart?.code,
      order.sparePart?.name,
      order.warehouse?.name,
      order.machine?.code,
      order.maintenanceRequest?.requestNumber,
      order.sourceCondition,
      order.status,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const columns = useMemo<GridColumn<RepairOrderSummary>[]>(() => ([
    { key: 'repairOrderNumber', header: t('common.code'), render: (r) => r.repairOrderNumber || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (r) => r.sparePart?.name || '-' },
    { key: 'sourceCondition', header: t('maintenance.condition'), render: (r) => <LocalizedValue value={r.sourceCondition} /> },
    { key: 'sourceQuantity', header: t('common.quantity'), render: (r) => r.sourceQuantity },
    { key: 'repairedQuantity', header: t('maintenance.repairedQuantity'), render: (r) => r.repairedQuantity ?? 0 },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
  ]), [t]);

  const statusOptions = useMemo(() => REPAIR_STATUS_OPTIONS.map((value) => ({
    value,
    label: t(`status.${value}`),
  })), [t]);

  const conditionOptions = useMemo(() => REPAIR_SOURCE_CONDITIONS.map((value) => ({
    value,
    label: t(value === 'USED_REPAIRABLE' ? 'maintenance.conditionUsedRepairable' : 'maintenance.conditionDamagedRepairable'),
  })), [t]);

  return (
    <div>
      <PageHeader title={t('maintenance.repairOrders')} />

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="repair-order-filters">
        <label className="text-xs text-gray-600">
          {t('common.status')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t('common.all')}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          {t('maintenance.condition')}
          <select
            value={sourceCondition}
            onChange={(e) => setSourceCondition(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t('common.all')}</option>
            {conditionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <F9Lookup
          label={t('maintenance.warehouse')}
          name="repairWarehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          adapter={warehouseAdapter}
          bindToActiveContext
        />

        <F9Lookup
          label={t('maintenance.sparePartLabel')}
          name="repairSparePart"
          value={sparePartId}
          onChange={setSparePartId}
          adapter={sparePartAdapter}
        />

        <F9Lookup
          label={t('maintenance.machine')}
          name="repairMachine"
          value={machineId}
          onChange={setMachineId}
          adapter={machineAdapter}
          bindToActiveContext
        />

        {hasFilters ? (
          <div className="md:col-span-2 lg:col-span-5">
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              {t('maintenance.repairClearFilters')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mb-3">
        <Button size="sm" variant="secondary" onClick={() => exec('queue')}>
          {t('maintenance.repairablePartsQueue')}
        </Button>
      </div>

      <AdminDataGrid
        columns={columns}
        data={visibleData}
        keyExtractor={(r: RepairOrderSummary) => r.id}
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

      <RepairOrderActionDialog
        actionKey={pending?.actionKey ?? null}
        form={form}
        fieldErrors={fieldErrors}
        remaining={Number(pending?.order.remainingQuantity ?? pending?.order.sourceQuantity ?? 0)}
        orderLabel={pending?.order.repairOrderNumber || pending?.order.id}
        saving={saving}
        error={actionError}
        onChange={setForm}
        onSubmit={submitAction}
        onClose={closeDialogs}
      />
    </div>
  );
}
