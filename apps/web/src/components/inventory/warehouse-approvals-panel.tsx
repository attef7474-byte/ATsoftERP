'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useToast } from '../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../components/admin/error-handler';
import { useAuth } from '../../lib/auth-context';
import { WarehouseApprovalRow, WarehouseApprovalType, WarehouseApprovalsResponse } from '../../lib/admin-types';
import { Select, Pagination, ConfirmDialog, Textarea } from '../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../components/admin/admin-action-bar';

type ApprovalAction = 'approve' | 'reject' | 'withdraw' | 'cancelApproval';

interface PendingAction {
  row: WarehouseApprovalRow;
  action: ApprovalAction;
}

const TYPES: WarehouseApprovalType[] = ['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'];
const STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'];

function typeLabelKey(value: WarehouseApprovalType): string {
  return 'inventory.warehouseApprovals.type' + value;
}

function statusLabelKey(value: string): string {
  return 'inventory.warehouseApprovals.status' + value;
}

function toNumber(value: number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Every action is executed through the native endpoint of the request family
 * that owns the row. This page is a read-only aggregation plus navigation layer;
 * it never posts stock or bypasses the native permission/status guards.
 */
function nativeActionPath(row: WarehouseApprovalRow, action: ApprovalAction): string {
  if (row.type === 'SPARE_PART') {
    const parentId = row.parentEntityId || row.entityId;
    return `/maintenance/requests/${parentId}/parts/${row.entityId}/${action}`;
  }
  if (row.type === 'RAW_MATERIAL') {
    const suffix = action === 'cancelApproval' ? 'cancel-approval' : action;
    return `/production/material-documents/${row.entityId}/${suffix}`;
  }
  const suffix = action === 'cancelApproval' ? 'cancel-approval' : action;
  return `/inventory/finished-goods-issues/${row.entityId}/${suffix}`;
}

function requiredPermission(row: WarehouseApprovalRow, action: ApprovalAction): string {
  if (row.type === 'SPARE_PART') {
    if (action === 'approve') return 'maintenance-request-parts:approve';
    if (action === 'reject') return 'maintenance-request-parts:reject';
    if (action === 'withdraw') return 'maintenance-request-parts:request';
    return '';
  }
  if (row.type === 'RAW_MATERIAL') {
    if (action === 'approve') return 'production-material-document:approve';
    if (action === 'reject') return 'production-material-document:reject';
    if (action === 'withdraw') return 'production-material-document:withdraw';
    if (action === 'cancelApproval') return 'production-material-document:cancel-approval';
    return '';
  }
  if (action === 'approve') return 'finished-goods-issue:approve';
  if (action === 'reject') return 'finished-goods-issue:reject';
  if (action === 'withdraw') return 'finished-goods-issue:withdraw';
  if (action === 'cancelApproval') return 'finished-goods-issue:cancel-approval';
  return '';
}

function actionAllowedInStatus(row: WarehouseApprovalRow, action: ApprovalAction): boolean {
  // Spare-part lines keep their native REQUESTED status for "awaiting a
  // warehouse decision"; the flat authorities use SUBMITTED.
  const awaitingDecision = row.status === 'SUBMITTED' || (row.type === 'SPARE_PART' && row.status === 'REQUESTED');
  if (action === 'approve' || action === 'reject' || action === 'withdraw') return awaitingDecision;
  // A prior approval can only be cancelled for the flat authorities that model it.
  if (action === 'cancelApproval') return row.status === 'APPROVED' && row.type !== 'SPARE_PART';
  return false;
}

export function WarehouseApprovalsPanel() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { user, isSuperAdmin } = useAuth();

  const [data, setData] = useState<WarehouseApprovalRow[]>([]);
  const [meta, setMeta] = useState<WarehouseApprovalsResponse['meta']>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    counts: { SPARE_PART: 0, RAW_MATERIAL: 0, FINISHED_GOODS: 0 },
  });
  const [granted, setGranted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');

  const [selectedKey, setSelectedKey] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);

  const grantedSet = useMemo(() => new Set(granted), [granted]);

  const can = useCallback(
    (permission: string) => isSuperAdmin || (!!permission && grantedSet.has(permission)),
    [isSuperAdmin, grantedSet],
  );

  const canAct = useCallback(
    (row: WarehouseApprovalRow, action: ApprovalAction) => {
      if (!actionAllowedInStatus(row, action)) return false;
      if (!can(requiredPermission(row, action))) return false;
      // Withdraw belongs to the requester; the recorded requester is the only
      // actor the inbox offers it to (the native endpoint re-validates). Approve
      // and reject are warehouse actions, guarded server-side against
      // self-approval.
      if (action === 'withdraw' && row.requestedById && user?.id && row.requestedById !== user.id) return false;
      return true;
    },
    [can, user],
  );

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20, status: statusFilter };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get<WarehouseApprovalsResponse>('/inventory/approvals', { params });
      setData(res.data || []);
      setMeta(res.meta);
      setGranted(res.permissions || []);
    } catch (err: any) { setError(err?.message || t('inventory.warehouseApprovals.loadFailed')); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter, t]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  useEffect(() => { fetchData(); }, []);

  const openAction = (row: WarehouseApprovalRow, action: ApprovalAction) => {
    setSelectedKey(row.key);
    setReason('');
    setValidationError('');
    setPending({ row, action });
  };

  const closeAction = () => { setPending(null); setReason(''); setValidationError(''); };

  const handleConfirm = async () => {
    if (!pending) return;
    const requiresReason = pending.action === 'reject' || pending.action === 'cancelApproval';
    if (requiresReason && !reason.trim()) {
      setValidationError(t('inventory.warehouseApprovals.reasonRequired'));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (reason.trim()) body.reason = reason.trim();
      await api.patch(nativeActionPath(pending.row, pending.action), Object.keys(body).length > 0 ? body : undefined);
      const successKey =
        pending.action === 'approve' ? 'approveSuccess'
        : pending.action === 'reject' ? 'rejectSuccess'
        : pending.action === 'withdraw' ? 'withdrawSuccess'
        : 'cancelApprovalSuccess';
      showToast(t('inventory.warehouseApprovals.' + successKey), 'success');
      closeAction();
      setSelectedKey('');
      fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<WarehouseApprovalRow>[] = [
    { key: 'type', header: t('inventory.warehouseApprovals.type'), render: (r) => t(typeLabelKey(r.type)) },
    { key: 'reference', header: t('inventory.warehouseApprovals.reference'), render: (r) => <span className="font-medium" dir="ltr">{r.reference}</span> },
    { key: 'title', header: t('inventory.warehouseApprovals.description'), render: (r) => r.title || '-' },
    { key: 'requestedBy', header: t('inventory.warehouseApprovals.requestedBy'), render: (r) => r.requestedByName || '-' },
    { key: 'requestedAt', header: t('inventory.warehouseApprovals.requestedAt'), render: (r) => (r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '-') },
    { key: 'warehouse', header: t('inventory.warehouseApprovals.warehouse'), render: (r) => r.warehouse?.name || '-' },
    { key: 'lineCount', header: t('inventory.warehouseApprovals.lineCount'), align: 'center', render: (r) => String(r.lineCount) },
    { key: 'totalQuantity', header: t('inventory.warehouseApprovals.totalQuantity'), align: 'right', render: (r) => <span dir="ltr">{toNumber(r.totalQuantity)}</span> },
    { key: 'status', header: t('inventory.warehouseApprovals.status'), render: (r) => <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{t(statusLabelKey(r.status))}</span> },
  ];

  const gridActions: GridAction<WarehouseApprovalRow>[] = [
    { label: t('inventory.warehouseApprovals.approve'), onClick: (r) => openAction(r, 'approve'), enabled: (r) => canAct(r, 'approve') },
    { label: t('inventory.warehouseApprovals.reject'), onClick: (r) => openAction(r, 'reject'), enabled: (r) => canAct(r, 'reject'), variant: 'danger' },
    { label: t('inventory.warehouseApprovals.withdraw'), onClick: (r) => openAction(r, 'withdraw'), enabled: (r) => canAct(r, 'withdraw') },
    { label: t('inventory.warehouseApprovals.cancelApproval'), onClick: (r) => openAction(r, 'cancelApproval'), enabled: (r) => canAct(r, 'cancelApproval'), variant: 'danger' },
  ];

  const counts = meta.counts || { SPARE_PART: 0, RAW_MATERIAL: 0, FINISHED_GOODS: 0 };
  const requiresReason = pending?.action === 'reject' || pending?.action === 'cancelApproval';
  const dialogTitle = pending
    ? t('inventory.warehouseApprovals.' + (pending.action === 'cancelApproval' ? 'cancelApproval' : pending.action))
    : '';
  const dialogMessage = pending
    ? t(
        'inventory.warehouseApprovals.' +
          (pending.action === 'approve' ? 'confirmApprove'
          : pending.action === 'reject' ? 'confirmReject'
          : pending.action === 'withdraw' ? 'confirmWithdraw'
          : 'confirmCancelApproval'),
      )
    : '';

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">{t('inventory.warehouseApprovals.subtitle')}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.warehouseApprovals.totalPending')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{toNumber(counts.SPARE_PART) + toNumber(counts.RAW_MATERIAL) + toNumber(counts.FINISHED_GOODS)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.warehouseApprovals.countSparePart')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{toNumber(counts.SPARE_PART)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.warehouseApprovals.countRawMaterial')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{toNumber(counts.RAW_MATERIAL)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.warehouseApprovals.countFinishedGoods')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{toNumber(counts.FINISHED_GOODS)}</p>
        </div>
      </div>

      <div className="mb-4 grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder={t('inventory.warehouseApprovals.allTypes')}
          options={TYPES.map((value) => ({ value, label: t(typeLabelKey(value)) }))}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
      </div>

      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r) => r.key}
        onRowClick={(r) => setSelectedKey(r.key)}
        selectedKey={selectedKey}
        loading={loading}
        emptyMessage={t('inventory.warehouseApprovals.emptyMessage')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('inventory.warehouseApprovals.searchPlaceholder')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={closeAction}
        onConfirm={handleConfirm}
        title={dialogTitle}
        message={dialogMessage}
        variant={pending?.action === 'reject' || pending?.action === 'cancelApproval' ? 'danger' : 'primary'}
        loading={saving}
      >
        {(requiresReason || pending?.action === 'withdraw') && (
          <div className="pt-3">
            <Textarea
              label={
                pending?.action === 'reject'
                  ? t('inventory.warehouseApprovals.rejectReason')
                  : pending?.action === 'cancelApproval'
                    ? t('inventory.warehouseApprovals.cancelApprovalReason')
                    : t('inventory.warehouseApprovals.withdrawReason')
              }
              value={reason}
              onChange={(e) => { setReason(e.target.value); setValidationError(''); }}
              required={requiresReason}
            />
            {validationError && <p className="mt-1 text-sm text-red-600">{validationError}</p>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
