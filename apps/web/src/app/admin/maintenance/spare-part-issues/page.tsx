'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useAuth } from '../../../../lib/auth-context';
import { Button, Input, Select, Pagination, PageHeader, Modal } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import {
  useRegisterAdminActions,
  useStableHandlers,
  ActionAddIcon,
  ActionRefreshIcon,
} from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { F9Lookup, warehouseAdapter, machineInstalledPartAdapter } from '../../../../components/f9';
import {
  COST_PURPOSE_VALUES,
  MAINTENANCE_COST_PURPOSE,
  COST_PURPOSE_OVERRIDE_PERMISSION,
} from '../../../../lib/cost-purpose';

interface IssuableRow {
  id: string;
  maintenanceRequestId: string;
  requestNumber: string;
  requestTitle: string;
  requestStatus: string;
  machine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string; productId: string | null; unit: string | null; status: string; deletedAt: string | null; isCritical: boolean } | null;
  requestedQuantity: number;
  approvedQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  remainingIssuableQuantity: number;
  stockIssueStatus: string | null;
  warehouse: { id: string; code: string; name: string } | null;
  lastIssueAt: string | null;
  lastIssueBy: { id: string; name: string } | null;
  issuable: boolean;
  availableQuantity: number | null;
}

interface IssueForm {
  warehouseId: string;
  issuedQuantity: number;
  issuedStockCondition: string;
  replacementAction: string;
  oldInstalledPartId: string;
  oldInstalledPart: any;
  removedPartCondition: string;
  removedPartWarehouseId: string;
  noReturnReason: string;
  costPurpose: string;
  costPurposeOverrideReason: string;
  notes: string;
}

/**
 * R4R — canonical Spare Part Issue (صرف قطع الغيار).
 *
 * This is a standalone warehouse transaction screen. It is intentionally NOT part of
 * the maintenance request form: the requirement is selected here as READ-ONLY context
 * (request, machine, component, spare part, approved and remaining quantity), and only
 * the warehouse, the quantity and the replacement facts are entered.
 *
 * The spare part, machine, machine component and approved quantity are never editable
 * here — the backend resolves them from the selected requirement inside the active
 * company/branch, so the screen cannot be used to issue the wrong part or to issue more
 * than was approved.
 */
export default function SparePartIssuesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { isSuperAdmin, permissions } = useAuth();
  const canOverrideCostPurpose =
    isSuperAdmin || Boolean(permissions?.permissions.includes(COST_PURPOSE_OVERRIDE_PERMISSION));

  const [data, setData] = useState<IssuableRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conditionBalances, setConditionBalances] = useState<any[]>([]);
  const [conditionBalancesLoading, setConditionBalancesLoading] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // R4R: the return flow is only for UNUSED, still-usable stock that goes back into
  // the SAME warehouse as usable balance. Removed/damaged parts are returned through
  // the issue itself (replacementAction + removedPart*), never here, so no damaged
  // part can be placed into usable stock.
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnForm, setReturnForm] = useState({ returnQuantity: 0, notes: '' });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});

  // One idempotency key per opened form. It is generated when the form opens and
  // survives retries of the SAME submission, so a double click, a network retry or a
  // refresh-after-error cannot deduct the same stock twice. Opening a NEW form for a
  // different requirement generates a new key.
  const [clientRequestId, setClientRequestId] = useState('');

  const [form, setForm] = useState<IssueForm>({
    warehouseId: '',
    issuedQuantity: 0,
    issuedStockCondition: 'NEW',
    replacementAction: 'NEW_INSTALLATION',
    oldInstalledPartId: '',
    oldInstalledPart: null as any,
    removedPartCondition: '',
    removedPartWarehouseId: '',
    noReturnReason: '',
    costPurpose: MAINTENANCE_COST_PURPOSE,
    costPurposeOverrideReason: '',
    notes: '',
  });

  const selectedRow = useMemo(() => data.find((d) => d.id === selectedId) ?? null, [data, selectedId]);
  const isReplacement = form.replacementAction !== 'NEW_INSTALLATION';

  // Stock that was issued and has not come back yet. Only this amount is returnable,
  // and it matches the server-side guard so the screen cannot offer an action the
  // authority would reject.
  const netIssuedQuantity = (r: IssuableRow) => (r.issuedQuantity || 0) - (r.returnedQuantity || 0);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page), limit: '10' });
        if (search) params.set('search', search);
        const res = await api.get<{ data: IssuableRow[]; meta: typeof meta }>(`/spare-part-issues?${params}`);
        setData(res.data);
        setMeta(res.meta);
      } catch (e: any) {
        setError(e.message || t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [search, t],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Condition balances are read-only context for the quantity being issued.
  useEffect(() => {
    const sparePartId = selectedRow?.sparePart?.id;
    if (!modalOpen || !sparePartId) {
      setConditionBalances([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setConditionBalancesLoading(true);
      try {
        const res = await api.get<any[]>(`/spare-part-conditions/by-spare-part/${sparePartId}`);
        if (!cancelled) setConditionBalances(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setConditionBalances([]);
      } finally {
        if (!cancelled) setConditionBalancesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, selectedRow?.sparePart?.id]);

  const openIssue = useCallback((row: IssuableRow) => {
    setSelectedId(row.id);
    setErrors({});
    setConditionBalances([]);
    setClientRequestId(crypto.randomUUID());
    setForm({
      warehouseId: row.warehouse?.id ?? '',
      issuedQuantity: row.remainingIssuableQuantity,
      issuedStockCondition: 'NEW',
      replacementAction: 'NEW_INSTALLATION',
      oldInstalledPartId: '',
      oldInstalledPart: null,
      removedPartCondition: '',
      removedPartWarehouseId: '',
      noReturnReason: '',
costPurpose: MAINTENANCE_COST_PURPOSE as string,
      costPurposeOverrideReason: '',
      notes: '',
    });
    setModalOpen(true);
  }, []);

  const openReturn = useCallback((row: IssuableRow) => {
    setSelectedId(row.id);
    setReturnErrors({});
    // Default to the full net issued amount, which is what an operator returns when a
    // part was issued in error and never installed.
    setReturnForm({ returnQuantity: (row.issuedQuantity || 0) - (row.returnedQuantity || 0), notes: '' });
    setReturnOpen(true);
  }, []);

  const submitReturn = async () => {
    if (!selectedRow) return;
    const netIssued = (selectedRow.issuedQuantity || 0) - (selectedRow.returnedQuantity || 0);
    const next: Record<string, string> = {};
    if (netIssued <= 0) next.returnQuantity = t('sparePartIssue.noStockToReturn');
    else if (returnForm.returnQuantity <= 0) next.returnQuantity = t('validation.quantityMustBePositive');
    else if (returnForm.returnQuantity > netIssued) {
      next.returnQuantity = t('sparePartIssue.returnQuantityExceedsIssued');
    }
    setReturnErrors(next);
    if (Object.keys(next).length > 0) return;

    setReturnSubmitting(true);
    try {
      // Deliberately minimal payload: quantity and note only. No warehouse, part,
      // machine, condition or movement identity is accepted here, so the return can
      // never be aimed at another warehouse or another part.
      await api.post(`/spare-part-issues/${selectedRow.id}/return`, {
        maintenanceRequestId: selectedRow.maintenanceRequestId,
        returnQuantity: returnForm.returnQuantity,
        notes: returnForm.notes || undefined,
      });
      showToast(t('sparePartIssue.returnedSuccess'), 'success');
      setReturnOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const openHistory = async (row: IssuableRow) => {
    setSelectedId(row.id);
    setHistoryOpen(true);
    setMovementsLoading(true);
    try {
      const res = await api.get<any[]>(
        `/spare-part-issues/${row.id}/movements?maintenanceRequestId=${row.maintenanceRequestId}`,
      );
      setMovements(Array.isArray(res) ? res : []);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  const gridActions: GridAction<IssuableRow>[] = useMemo(
    () => [
      { label: t('sparePartIssue.issue'), onClick: (r) => openIssue(r), enabled: (r) => r.issuable },
      {
        label: t('sparePartIssue.returnUnusedStock'),
        onClick: (r) => openReturn(r),
        enabled: (r) => netIssuedQuantity(r) > 0,
      },
      {
        label: t('sparePartIssue.movements'),
        onClick: (r) => openHistory(r),
        enabled: (r) => (r.issuedQuantity ?? 0) > 0,
      },
    ],
    [t, openIssue, openReturn, openHistory],
  );

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    issue: () => {
      if (selectedRow) openIssue(selectedRow);
    },
    history: () => {
      if (selectedRow) openHistory(selectedRow);
    },
  });

  useRegisterAdminActions([
    {
      id: 'issue',
      labelKey: 'sparePartIssue.issue',
      icon: <ActionAddIcon />,
      onClick: () => exec('issue'),
      enabled: !!selectedRow?.issuable,
    },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  // R2-E: changing the action invalidates every action-specific field, so a stale
  // selection can never leak from one action into another submission.
  const selectReplacementAction = (action: string) => {
    setForm((f) => ({
      ...f,
      replacementAction: action,
      oldInstalledPartId: '',
      oldInstalledPart: null,
      removedPartCondition: '',
      removedPartWarehouseId: '',
      noReturnReason: '',
    }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n.oldInstalledPartId;
      delete n.removedPartCondition;
      delete n.removedPartWarehouseId;
      delete n.noReturnReason;
      return n;
    });
  };

  const submit = async () => {
    if (!selectedRow) return;
    const next: Record<string, string> = {};
    if (!form.warehouseId) next.warehouseId = t('sparePartRequest.selectWarehouseForIssue');
    if (form.issuedQuantity <= 0) next.issuedQuantity = t('validation.quantityMustBePositive');
    if (form.issuedQuantity > selectedRow.remainingIssuableQuantity) {
      next.issuedQuantity = t('sparePartIssue.quantityExceedsApproved');
    }
    if (isReplacement && (!form.oldInstalledPartId || !form.oldInstalledPart)) {
      next.oldInstalledPartId = t('sparePartRequest.selectOldInstalledPartRequired');
    }
    if (form.replacementAction === 'RETURNED_REMOVED_PART') {
      if (!form.removedPartCondition) next.removedPartCondition = t('sparePartRequest.removedPartConditionRequired');
      if (!form.removedPartWarehouseId) next.removedPartWarehouseId = t('sparePartRequest.removedPartWarehouseRequired');
    }
    if (form.replacementAction === 'NO_REMOVED_PART' && !form.noReturnReason.trim()) {
      next.noReturnReason = t('sparePartRequest.noReturnReasonRequired');
    }
    if (form.costPurpose !== MAINTENANCE_COST_PURPOSE && !form.costPurposeOverrideReason.trim()) {
      next.costPurposeOverrideReason = t('maintenance.costPurposeOverrideReasonRequired');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const payload: any = {
        requiredPartId: selectedRow.id,
        maintenanceRequestId: selectedRow.maintenanceRequestId,
        warehouseId: form.warehouseId,
        issuedQuantity: form.issuedQuantity,
        clientRequestId,
        notes: form.notes || undefined,
        issuedStockCondition: form.issuedStockCondition,
        replacementAction: form.replacementAction,
        costPurpose: form.costPurpose,
        costPurposeOverrideReason:
          form.costPurpose !== MAINTENANCE_COST_PURPOSE ? form.costPurposeOverrideReason.trim() : undefined,
      };
      // Only the installed-part record id is ever sent. The removed spare-part and
      // product identity are derived server-side, so OLD and NEW can never be
      // conflated or dictated by the client.
      if (isReplacement) {
        payload.oldInstalledPartId = form.oldInstalledPartId;
      }
      if (form.replacementAction === 'RETURNED_REMOVED_PART') {
        payload.removedPartCondition = form.removedPartCondition;
        payload.removedPartWarehouseId = form.removedPartWarehouseId;
        // Full-quantity removal of the one physical installed record; the backend
        // re-derives this and fails closed on any mismatch.
        payload.removedPartQuantity = form.oldInstalledPart?.installedQuantity;
      }
      if (form.replacementAction === 'NO_REMOVED_PART') {
        payload.noReturnReason = form.noReturnReason.trim();
      }
      await api.post('/spare-part-issues', payload);
      showToast(t('sparePartIssue.issuedSuccess'), 'success');
      setModalOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  };


  const columns: GridColumn<IssuableRow>[] = [
    { key: 'requestNumber', header: t('sparePartIssue.request'), render: (r) => r.requestNumber },
    { key: 'machine', header: t('sparePartIssue.machine'), render: (r) => (r.machine ? `${r.machine.code} - ${r.machine.name}` : '-') },
    { key: 'component', header: t('sparePartIssue.component'), render: (r) => (r.machineComponent ? r.machineComponent.name : t('sparePartRequest.machineLevelPart')) },
    {
      key: 'sparePart',
      header: t('sparePartIssue.sparePart'),
      render: (r) => (r.sparePart ? `${r.sparePart.code} - ${r.sparePart.name}` : '-'),
    },
    { key: 'remaining', header: t('sparePartIssue.remaining'), render: (r) => r.remainingIssuableQuantity },
    { key: 'available', header: t('sparePartIssue.availableInWarehouse'), render: (r) => (r.availableQuantity ?? '-') },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) =>
        r.issuable
          ? t('sparePartIssue.issuable')
          : r.remainingIssuableQuantity <= 0
            ? t('sparePartIssue.fullyIssued')
            : t('sparePartIssue.notIssuable'),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('sparePartIssue.title')} />
      <p className="text-sm text-gray-500 mb-4">{t('sparePartIssue.description')}</p>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<IssuableRow>
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('sparePartIssue.noIssuable')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('sparePartIssue.issueModalTitle')}>
        {selectedRow ? (
          <div className="space-y-4">
            {/* Read-only maintenance context. Derived server-side from the requirement. */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
              <p className="font-medium text-gray-700">{t('sparePartIssue.readOnlyContext')}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-gray-500">{t('sparePartIssue.request')}</dt>
                <dd className="font-medium">{selectedRow.requestNumber}</dd>
                <dt className="text-gray-500">{t('sparePartIssue.machine')}</dt>
                <dd className="font-medium">{selectedRow.machine ? `${selectedRow.machine.code} - ${selectedRow.machine.name}` : '-'}</dd>
                <dt className="text-gray-500">{t('sparePartIssue.component')}</dt>
                <dd className="font-medium">
                  {selectedRow.machineComponent ? selectedRow.machineComponent.name : t('sparePartRequest.machineLevelPart')}
                </dd>
                <dt className="text-gray-500">{t('sparePartIssue.sparePart')}</dt>
                <dd className="font-medium">
                  {selectedRow.sparePart ? `${selectedRow.sparePart.code} - ${selectedRow.sparePart.name}` : '-'}
                </dd>
                <dt className="text-gray-500">{t('sparePartIssue.approvedQuantity')}</dt>
                <dd className="font-medium">{selectedRow.approvedQuantity}</dd>
                <dt className="text-gray-500">{t('sparePartIssue.remaining')}</dt>
                <dd className="font-medium">{selectedRow.remainingIssuableQuantity}</dd>
              </dl>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('inventory.warehouse')}</label>
              <F9Lookup
                value={form.warehouseId}
                onChange={(v) => {
                  setForm((f) => ({ ...f, warehouseId: v }));
                  setErrors((prev) => ({ ...prev, warehouseId: '' }));
                }}
                adapter={warehouseAdapter}
              />
              {errors.warehouseId && <p className="text-red-500 text-sm mt-1">{errors.warehouseId}</p>}
              <p className="text-xs text-amber-600 mt-1">{t('sparePartRequest.selectSparePartWarehouseOnly')}</p>
            </div>

            {conditionBalancesLoading ? (
              <p className="text-xs text-gray-400">{t('common.loading')}</p>
            ) : conditionBalances.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('sparePartRequest.availableConditionBalances')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {conditionBalances.map((cb: any) => {
                    const conditionLabels: Record<string, string> = {
                      NEW: t('sparePartRequest.conditionNew'),
                      USED_SERVICEABLE: t('sparePartRequest.conditionUsedServiceable'),
                      USED_REPAIRABLE: t('sparePartRequest.conditionUsedRepairable'),
                      DAMAGED_REPAIRABLE: t('sparePartRequest.conditionDamagedRepairable'),
                      DAMAGED_NOT_REPAIRABLE: t('sparePartRequest.conditionDamagedNotRepairable'),
                    };
                    return (
                      <span
                        key={cb.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700"
                      >
                        {conditionLabels[cb.condition] || cb.condition}: <strong>{cb.availableQuantity}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.issuedQuantity')}</label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={form.issuedQuantity || ''}
                onChange={(e) => {
                  setForm((f) => ({ ...f, issuedQuantity: parseFloat(e.target.value) || 0 }));
                  setErrors((prev) => ({ ...prev, issuedQuantity: '' }));
                }}
              />
              {errors.issuedQuantity && <p className="text-red-500 text-sm mt-1">{errors.issuedQuantity}</p>}
            </div>

            <Select
              label={t('sparePartRequest.issuedStockCondition')}
              value={form.issuedStockCondition}
              onChange={(e) => setForm((f) => ({ ...f, issuedStockCondition: e.target.value }))}
              options={[
                { value: 'NEW', label: t('sparePartRequest.conditionNew') },
                { value: 'USED_SERVICEABLE', label: t('sparePartRequest.conditionUsedServiceable') },
                { value: 'USED_REPAIRABLE', label: t('sparePartRequest.conditionUsedRepairable') },
                { value: 'DAMAGED_REPAIRABLE', label: t('sparePartRequest.conditionDamagedRepairable') },
                { value: 'DAMAGED_NOT_REPAIRABLE', label: t('sparePartRequest.conditionDamagedNotRepairable') },
              ]}
            />

            <Select
              label={t('common.costPurpose.label')}
              value={form.costPurpose}
              onChange={(e) => setForm((f) => ({ ...f, costPurpose: e.target.value }))}
              options={COST_PURPOSE_VALUES.map((v) => ({ value: v, label: t('common.costPurpose.' + v) }))}
            />
            {canOverrideCostPurpose && form.costPurpose !== MAINTENANCE_COST_PURPOSE && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.costPurpose.overrideReason')}</label>
                <Input
                  value={form.costPurposeOverrideReason}
                  onChange={(e) => setForm((f) => ({ ...f, costPurposeOverrideReason: e.target.value }))}
                  placeholder={t('common.costPurpose.overrideReasonHint')}
                />
                {errors.costPurposeOverrideReason && (
                  <p className="text-red-500 text-sm mt-1">{errors.costPurposeOverrideReason}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.replacementAction')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'].map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => selectReplacementAction(action)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      form.replacementAction === action
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {action === 'RETURNED_REMOVED_PART'
                      ? t('sparePartRequest.replacementReturnedRemoved')
                      : action === 'NO_REMOVED_PART'
                        ? t('sparePartRequest.replacementNoRemoved')
                        : t('sparePartRequest.replacementNewInstallation')}
                  </button>
                ))}
              </div>
            </div>

            {isReplacement && (
              <div className="p-3 border border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
                <p className="text-xs font-medium text-indigo-700">{t('sparePartRequest.oldInstalledPartSection')}</p>
                <F9Lookup
                  name="oldInstalledPartId"
                  label={t('sparePartRequest.oldInstalledPart')}
                  value={form.oldInstalledPartId}
                  onChange={(value) => {
                    setForm((f) => ({ ...f, oldInstalledPartId: value, oldInstalledPart: value ? f.oldInstalledPart : null }));
                    setErrors((prev) => ({ ...prev, oldInstalledPartId: '' }));
                  }}
                  onItemSelect={(part: any) => setForm((f) => ({ ...f, oldInstalledPart: part }))}
                  adapter={machineInstalledPartAdapter}
                  filters={{ machineId: selectedRow.machine?.id || '', status: 'ACTIVE' }}
                  placeholder={t('sparePartRequest.oldInstalledPartPlaceholder')}
                  error={errors.oldInstalledPartId}
                />
                {form.oldInstalledPart && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                    <dt className="text-gray-500">{t('sparePartIssue.oldSparePart')}</dt>
                    <dd className="font-medium">
                      {form.oldInstalledPart.sparePart
                        ? `[${form.oldInstalledPart.sparePart.code}] ${form.oldInstalledPart.sparePart.name}`
                        : '-'}
                    </dd>
                    <dt className="text-gray-500">{t('sparePartRequest.installedCondition')}</dt>
                    <dd className="font-medium">{form.oldInstalledPart.installedCondition}</dd>
                    <dt className="text-gray-500">{t('sparePartRequest.installedQuantity')}</dt>
                    <dd className="font-medium">{form.oldInstalledPart.installedQuantity}</dd>
                    <dt className="text-gray-500">{t('sparePartIssue.component')}</dt>
                    <dd className="font-medium">
                      {form.oldInstalledPart.machineComponent?.name || t('sparePartRequest.machineLevelPart')}
                    </dd>
                    {form.oldInstalledPart.serialNumber && (
                      <>
                        <dt className="text-gray-500">{t('sparePartRequest.serialNumber')}</dt>
                        <dd className="font-medium">{form.oldInstalledPart.serialNumber}</dd>
                      </>
                    )}
                    {form.oldInstalledPart.batchNumber && (
                      <>
                        <dt className="text-gray-500">{t('sparePartRequest.batchNumber')}</dt>
                        <dd className="font-medium">{form.oldInstalledPart.batchNumber}</dd>
                      </>
                    )}
                  </dl>
                )}
                {form.replacementAction === 'RETURNED_REMOVED_PART' && (
                  <>
                    <Select
                      label={t('sparePartRequest.removedPartCondition')}
                      value={form.removedPartCondition}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, removedPartCondition: e.target.value }));
                        setErrors((prev) => ({ ...prev, removedPartCondition: '' }));
                      }}
                      options={[
                        { value: 'NEW', label: t('sparePartRequest.conditionNew') },
                        { value: 'USED_SERVICEABLE', label: t('sparePartRequest.conditionUsedServiceable') },
                        { value: 'USED_REPAIRABLE', label: t('sparePartRequest.conditionUsedRepairable') },
                        { value: 'DAMAGED_REPAIRABLE', label: t('sparePartRequest.conditionDamagedRepairable') },
                        { value: 'DAMAGED_NOT_REPAIRABLE', label: t('sparePartRequest.conditionDamagedNotRepairable') },
                      ]}
                    />
                    {errors.removedPartCondition && (
                      <p className="text-red-500 text-sm">{errors.removedPartCondition}</p>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        {t('sparePartRequest.removedPartWarehouse')}
                      </label>
                      <F9Lookup
                        value={form.removedPartWarehouseId}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, removedPartWarehouseId: v }));
                          setErrors((prev) => ({ ...prev, removedPartWarehouseId: '' }));
                        }}
                        adapter={warehouseAdapter}
                      />
                      {errors.removedPartWarehouseId && (
                        <p className="text-red-500 text-sm mt-1">{errors.removedPartWarehouseId}</p>
                      )}
                    </div>
                  </>
                )}
                {form.replacementAction === 'NO_REMOVED_PART' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t('sparePartRequest.noReturnReason')}
                    </label>
                    <Input
                      value={form.noReturnReason}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, noReturnReason: e.target.value }));
                        setErrors((prev) => ({ ...prev, noReturnReason: '' }));
                      }}
                    />
                    {errors.noReturnReason && <p className="text-red-500 text-sm mt-1">{errors.noReturnReason}</p>}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.notes')}</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2">
              <Button onClick={submit} disabled={submitting}>{t('sparePartIssue.confirmIssue')}</Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">{t('common.loading')}</div>
        )}
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title={t('sparePartIssue.returnModalTitle')}>
        {selectedRow ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
              <p className="font-medium text-gray-700">{t('sparePartIssue.readOnlyContext')}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-gray-500">{t('sparePartIssue.request')}</dt>
                <dd className="font-medium">{selectedRow.requestNumber}</dd>
                <dt className="text-gray-500">{t('sparePartIssue.sparePart')}</dt>
                <dd className="font-medium">
                  {selectedRow.sparePart ? `${selectedRow.sparePart.code} - ${selectedRow.sparePart.name}` : '-'}
                </dd>
                <dt className="text-gray-500">{t('inventory.warehouse')}</dt>
                <dd className="font-medium">{selectedRow.warehouse?.name ?? '-'}</dd>
                <dt className="text-gray-500">{t('sparePartIssue.approvedQuantity')}</dt>
                <dd className="font-medium">{selectedRow.approvedQuantity}</dd>
              </dl>
            </div>

            <p className="text-xs text-amber-600">{t('sparePartIssue.returnUnusedOnlyHint')}</p>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('sparePartIssue.returnQuantity')}
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={returnForm.returnQuantity}
                onChange={(e) => {
                  setReturnForm((f) => ({ ...f, returnQuantity: Number(e.target.value) }));
                  setReturnErrors((prev) => ({ ...prev, returnQuantity: '' }));
                }}
              />
              {returnErrors.returnQuantity && (
                <p className="text-red-500 text-sm mt-1">{returnErrors.returnQuantity}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.notes')}</label>
              <Input
                value={returnForm.notes}
                onChange={(e) => setReturnForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={submitReturn} disabled={returnSubmitting}>
                {t('sparePartRequest.returnStock')}
              </Button>
              <Button variant="secondary" onClick={() => setReturnOpen(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">{t('common.loading')}</div>
        )}
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('sparePartIssue.movements')}>
        {movementsLoading ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t('sparePartIssue.noMovements')}</div>
        ) : (
          <div className="space-y-2">
            {movements.map((m: any) => (
              <div key={m.id} className="flex justify-between items-center border-b pb-2 text-sm">
                <div>
                  <p className="font-medium">
                    {m.movementType === 'MAINTENANCE_ISSUE' ? t('sparePartRequest.issueStock') : t('sparePartRequest.returnStock')}
                  </p>
                  <p className="text-xs text-gray-500">{m.movementNumber || m.movementDate}</p>
                </div>
                <div className="text-left">
                  <p className="font-medium">{m.quantity}</p>
                  <p className="text-xs text-gray-500">{m.warehouse?.name || ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
