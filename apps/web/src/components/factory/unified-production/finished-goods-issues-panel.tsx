'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../components/admin/error-handler';
import { resolveApiErrorMessage } from '../../../lib/error-utils';
import { useAuth } from '../../../lib/auth-context';
import { FinishedGoodsIssue, FinishedGoodsIssueLine } from '../../../lib/admin-types';
import { Button, Input, Select, Pagination, Modal, ConfirmDialog, Textarea } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../components/f9/F9Lookup';
import { warehouseAdapter } from '../../../components/f9/lookup-adapters';
import { IssueLinesEditor, IssueLineDraft, createEmptyIssueLine } from '../../../app/admin/inventory/finished-goods-issues/_components/lines-editor';

const ISSUE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'];

function statusLabelKey(value: string): string {
  return 'inventory.finishedGoodsIssue.status' + value;
}

function sourceLabelKey(value: string): string {
  return 'inventory.finishedGoodsIssue.source' + value;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Resolve a scalar actor id to its display name; never render a raw id. */
function actorName(record: { actorNames?: Record<string, string> }, id?: string | null): string | null {
  return (id ? record.actorNames?.[id] : null) ?? null;
}

type ActionType =
  | 'create'
  | 'edit'
  | 'view'
  | 'submit'
  | 'withdraw'
  | 'approve'
  | 'reject'
  | 'cancelApproval'
  | 'post'
  | 'cancel'
  | 'reverse';

interface IssueForm {
  issueWarehouseId: string;
  purpose: string;
  issueDate: string;
  notes: string;
  lines: IssueLineDraft[];
}

export function FinishedGoodsIssuesPanel() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('finished-goods-issue:' + action)),
    [isSuperAdmin, permissions],
  );

  const [data, setData] = useState<FinishedGoodsIssue[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<ActionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<FinishedGoodsIssue | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, submitted: 0, approved: 0, posted: 0, quantity: 0 });

  const [form, setForm] = useState<IssueForm>({
    issueWarehouseId: '',
    purpose: '',
    issueDate: new Date().toISOString().slice(0, 10),
    notes: '',
    lines: [createEmptyIssueLine()],
  });

  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const resetForm = (preserve?: Partial<IssueForm>) => {
    setForm({
      issueWarehouseId: '',
      purpose: '',
      issueDate: new Date().toISOString().slice(0, 10),
      notes: '',
      lines: [createEmptyIssueLine()],
      ...preserve,
    });
    setValidationErrors({});
    setDetail(null);
  };

  const { exec } = useStableHandlers({
    new: () => { resetForm(); setAction('create'); },
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    {
      id: 'new',
      labelKey: 'inventory.finishedGoodsIssue.newIssue',
      icon: <ActionAddIcon />,
      permission: 'finished-goods-issue:create',
      onClick: () => exec('new'),
      enabled: can('create'),
    },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: FinishedGoodsIssue[]; meta: any }>('/inventory/finished-goods-issues', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('inventory.finishedGoodsIssue.errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, t]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<{ data: FinishedGoodsIssue[]; meta: any }>('/inventory/finished-goods-issues', { params: { limit: 100 } });
      const issues = res.data || [];
      const totals = { total: issues.length, submitted: 0, approved: 0, posted: 0, quantity: 0 };
      for (const issue of issues) {
        if (issue.status === 'SUBMITTED') totals.submitted += 1;
        if (issue.status === 'APPROVED') totals.approved += 1;
        if (issue.status === 'POSTED') {
          totals.posted += 1;
          for (const line of issue.lines || []) totals.quantity += toNumber(line.quantity);
        }
      }
      setSummary({ ...totals, quantity: Math.round(totals.quantity * 10000) / 10000 });
    } catch (err) { handleApiError(err); }
  }, [handleApiError]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchSummary(); }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: FinishedGoodsIssue }>(`/inventory/finished-goods-issues/${id}`);
      const fetched = res.data || null;
      setDetail(fetched);
      let logs: any[] = [];
      try {
        const audit = await api.get<{ data: any[] }>('/audit-logs', { params: { entity: 'FinishedGoodsIssue', search: id, limit: 20 } });
        logs = (audit.data || []).filter((l) => l.entityId === id);
      } catch { logs = []; }
      setHistory(logs);
      return fetched;
    } catch (err: any) { handleApiError(err); return null; }
    finally { setDetailLoading(false); }
  }, [handleApiError]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('finishedGoodsIssue.')) {
      const message = resolveApiErrorMessage(t, 'inventory.finishedGoodsIssue.errors.' + key.slice('finishedGoodsIssue.'.length));
      handleApiError(err, message ? { message } : undefined);
      return;
    }
    handleApiError(err);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (action === 'create' && !form.issueWarehouseId) errors.issueWarehouseId = t('inventory.finishedGoodsIssue.errors.warehouseRequired');
    if (form.lines.length === 0) errors.lines = t('inventory.finishedGoodsIssue.errors.lineRequired');
    const lineErrors: string[] = [];
    form.lines.forEach((line) => {
      if (!line.productId) lineErrors.push(t('inventory.finishedGoodsIssue.errors.productRequired'));
      if (!line.quantity || toNumber(line.quantity) <= 0) lineErrors.push(t('inventory.finishedGoodsIssue.errors.quantityPositive'));
      if (!line.unit) lineErrors.push(t('inventory.finishedGoodsIssue.errors.unitRequired'));
    });
    if (lineErrors.length > 0 && !errors.lines) errors.lines = lineErrors[0];
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const linesToPayload = (lines: IssueLineDraft[]) => lines.map((line) => ({
    productId: line.productId,
    quantity: toNumber(line.quantity),
    unit: line.unit.trim(),
    productUomId: line.productUomId || undefined,
    warehouseLocationId: line.warehouseLocationId || undefined,
    batchNumber: line.batchNumber.trim() || undefined,
    serialNumber: line.serialNumber.trim() || undefined,
    expiryDate: line.expiryDate || undefined,
    notes: line.notes.trim() || undefined,
  }));

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        issueWarehouseId: form.issueWarehouseId,
        purpose: form.purpose.trim() || undefined,
        issueDate: form.issueDate || undefined,
        notes: form.notes.trim() || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.post('/inventory/finished-goods-issues', payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    if (!detail) return;
    setSaving(true);
    try {
      const payload: any = {
        purpose: form.purpose.trim() || undefined,
        issueDate: form.issueDate || undefined,
        notes: form.notes.trim() || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.patch(`/inventory/finished-goods-issues/${detail.id}`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleTransition = async (path: string, body?: Record<string, unknown>) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.patch(`/inventory/finished-goods-issues/${selectedId}/${path}`, body);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleSubmit = () => handleTransition('submit');
  const handleApprove = () => handleTransition('approve');
  const handlePost = () => handleTransition('post');

  const handleWithdraw = () => handleTransition('withdraw', { reason: form.notes.trim() || undefined });

  const handleReject = async () => {
    const errors: Record<string, string> = {};
    if (!form.notes.trim()) errors.rejectReason = t('inventory.finishedGoodsIssue.errors.reasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await handleTransition('reject', { reason: form.notes.trim() });
  };

  const handleCancelApproval = async () => {
    const errors: Record<string, string> = {};
    if (!form.notes.trim()) errors.cancelApprovalReason = t('inventory.finishedGoodsIssue.errors.reasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await handleTransition('cancel-approval', { reason: form.notes.trim() });
  };

  const handleCancel = async () => {
    const errors: Record<string, string> = {};
    if (!form.notes.trim()) errors.cancelReason = t('inventory.finishedGoodsIssue.errors.reasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await handleTransition('cancel', { reason: form.notes.trim() });
  };

  const handleReverse = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        issueDate: form.issueDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      await api.post(`/inventory/finished-goods-issues/${selectedId}/reverse`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const openCreate = () => { resetForm(); setAction('create'); };

  const openEdit = async (issue: FinishedGoodsIssue) => {
    setSelectedId(issue.id);
    const current = await loadDetail(issue.id);
    const source = current || issue;
    setForm({
      issueWarehouseId: source.issueWarehouseId || '',
      purpose: source.purpose || '',
      issueDate: (source.issueDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes: source.notes || '',
      lines: (source.lines || []).map((line) => ({
        key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        productId: line.productId,
        quantity: String(line.quantity),
        unit: line.unit,
        productUomId: (line as any).productUomId || '',
        warehouseLocationId: line.warehouseLocationId || '',
        batchNumber: line.batchNumber || '',
        serialNumber: line.serialNumber || '',
        expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
        notes: line.notes || '',
      })),
    });
    setValidationErrors({});
    setAction('edit');
  };

  const openView = async (issue: FinishedGoodsIssue) => {
    setSelectedId(issue.id);
    await loadDetail(issue.id);
    setAction('view');
  };

  const openAction = (issue: FinishedGoodsIssue, type: ActionType, preserve?: Partial<IssueForm>) => {
    setSelectedId(issue.id);
    resetForm(preserve);
    setAction(type);
  };

  const columns: GridColumn<FinishedGoodsIssue>[] = [
    { key: 'issueNumber', header: t('inventory.finishedGoodsIssue.issueNumber'), render: (r) => <span className="font-medium">{r.issueNumber}</span> },
    { key: 'warehouse', header: t('inventory.finishedGoodsIssue.issueWarehouse'), render: (r) => r.issueWarehouse?.name || '-' },
    { key: 'purpose', header: t('inventory.finishedGoodsIssue.purpose'), render: (r) => r.purpose || '-' },
    { key: 'movementNumber', header: t('inventory.finishedGoodsIssue.movementNumber'), render: (r) => r.movementNumber || '-' },
    { key: 'issueDate', header: t('inventory.finishedGoodsIssue.issueDate'), render: (r) => new Date(r.issueDate).toLocaleDateString() },
    { key: 'source', header: t('inventory.finishedGoodsIssue.source'), render: (r) => t(sourceLabelKey(r.sourceType || 'MANUAL')) },
    { key: 'status', header: t('inventory.finishedGoodsIssue.status'), render: (r) => <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{t(statusLabelKey(r.status))}</span> },
  ];

  const gridActions: GridAction<FinishedGoodsIssue>[] = [
    { label: t('inventory.finishedGoodsIssue.view'), onClick: (r) => void openView(r), enabled: () => can('read') },
    { label: t('inventory.finishedGoodsIssue.edit'), permission: 'finished-goods-issue:update', onClick: (r) => void openEdit(r), enabled: (r) => can('update') && r.status === 'DRAFT' },
    { label: t('inventory.finishedGoodsIssue.submit'), permission: 'finished-goods-issue:submit', onClick: (r) => openAction(r, 'submit'), enabled: (r) => can('submit') && r.status === 'DRAFT' },
    { label: t('inventory.finishedGoodsIssue.withdraw'), permission: 'finished-goods-issue:withdraw', onClick: (r) => openAction(r, 'withdraw'), enabled: (r) => can('withdraw') && r.status === 'SUBMITTED' },
    { label: t('inventory.finishedGoodsIssue.approve'), permission: 'finished-goods-issue:approve', onClick: (r) => openAction(r, 'approve'), enabled: (r) => can('approve') && r.status === 'SUBMITTED' },
    { label: t('inventory.finishedGoodsIssue.reject'), permission: 'finished-goods-issue:reject', onClick: (r) => openAction(r, 'reject'), enabled: (r) => can('reject') && r.status === 'SUBMITTED', variant: 'danger' },
    { label: t('inventory.finishedGoodsIssue.cancelApproval'), permission: 'finished-goods-issue:cancel-approval', onClick: (r) => openAction(r, 'cancelApproval'), enabled: (r) => can('cancel-approval') && r.status === 'APPROVED', variant: 'danger' },
    { label: t('inventory.finishedGoodsIssue.post'), permission: 'finished-goods-issue:post', onClick: (r) => openAction(r, 'post'), enabled: (r) => can('post') && r.status === 'APPROVED' },
    { label: t('inventory.finishedGoodsIssue.cancel'), permission: 'finished-goods-issue:cancel', onClick: (r) => openAction(r, 'cancel'), enabled: (r) => can('cancel') && ['DRAFT', 'SUBMITTED', 'REJECTED'].includes(r.status), variant: 'danger' },
    { label: t('inventory.finishedGoodsIssue.reverse'), permission: 'finished-goods-issue:reverse', onClick: (r) => openAction(r, 'reverse', { issueDate: new Date().toISOString().slice(0, 10) }), enabled: (r) => can('reverse') && r.status === 'POSTED' },
  ];

  const performAction = async () => {
    if (action === 'create') await handleCreate();
    if (action === 'edit') await handleUpdate();
    if (action === 'submit') await handleSubmit();
    if (action === 'withdraw') await handleWithdraw();
    if (action === 'approve') await handleApprove();
    if (action === 'reject') await handleReject();
    if (action === 'cancelApproval') await handleCancelApproval();
    if (action === 'post') await handlePost();
    if (action === 'cancel') await handleCancel();
    if (action === 'reverse') await handleReverse();
  };

  const viewRecord = detail || selectedRecord;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">{t('inventory.finishedGoodsIssue.subtitle')}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.finishedGoodsIssue.totalDocuments')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.finishedGoodsIssue.submittedCount')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.submitted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.finishedGoodsIssue.approvedCount')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.approved}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('inventory.finishedGoodsIssue.postedCount')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.posted}</p>
        </div>
      </div>

      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('inventory.finishedGoodsIssue.allStatuses')}
          options={ISSUE_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
      </div>

      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}

      {/* Create / Edit modal */}
      <Modal
        open={action === 'create' || action === 'edit'}
        onClose={() => { setAction(null); resetForm(); }}
        title={action === 'edit' ? t('inventory.finishedGoodsIssue.editIssue') : t('inventory.finishedGoodsIssue.newIssue')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup
                label={t('inventory.finishedGoodsIssue.issueWarehouse')}
                value={form.issueWarehouseId}
                adapter={warehouseAdapter}
                onChange={(v) => { setForm({ ...form, issueWarehouseId: v, lines: [createEmptyIssueLine()] }); setValidationErrors(prev => ({ ...prev, issueWarehouseId: '' })); }}
                disabled={action === 'edit'}
              />
              {validationErrors.issueWarehouseId && <p className="mt-1 text-sm text-red-600">{validationErrors.issueWarehouseId}</p>}
            </div>
            <div>
              <Input label={t('inventory.finishedGoodsIssue.issueDate')} type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </div>
          </div>
          <Input label={t('inventory.finishedGoodsIssue.purpose')} maxLength={500} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />

          <IssueLinesEditor
            warehouseId={form.issueWarehouseId}
            lines={form.lines}
            onChange={(lines) => { setForm({ ...form, lines }); setValidationErrors(prev => ({ ...prev, lines: '' })); }}
            error={validationErrors.lines}
          />
          <Textarea label={t('inventory.finishedGoodsIssue.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setAction(null); resetForm(); }}>{t('actions.cancel')}</Button>
            <Button onClick={performAction} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* View modal */}
      <Modal
        open={action === 'view'}
        onClose={() => { setAction(null); setDetail(null); }}
        title={t('inventory.finishedGoodsIssue.detail')}
        size="lg"
      >
        {detailLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">{t('common.loading')}</p>
        ) : viewRecord ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.issueNumber')}: </span><span className="font-medium" dir="ltr">{viewRecord.issueNumber}</span></div>
              <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.status')}: </span>{t(statusLabelKey(viewRecord.status))}</div>
              <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.issueWarehouse')}: </span>{viewRecord.issueWarehouse?.name || '-'}</div>
              <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.issueDate')}: </span>{new Date(viewRecord.issueDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.source')}: </span>{t(sourceLabelKey(viewRecord.sourceType || 'MANUAL'))}</div>
              {viewRecord.reversesIssue && (
                <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.reversesIssue')}: </span><span dir="ltr">{viewRecord.reversesIssue.issueNumber}</span></div>
              )}
              {actorName(viewRecord, viewRecord.createdById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.createdBy')}: </span>{actorName(viewRecord, viewRecord.createdById)}</div>}
              {actorName(viewRecord, viewRecord.submittedById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.submittedBy')}: </span>{actorName(viewRecord, viewRecord.submittedById)}</div>}
              {viewRecord.submittedAt && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.submittedAt')}: </span>{new Date(viewRecord.submittedAt).toLocaleString()}</div>}
              {actorName(viewRecord, viewRecord.approvedById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.approvedBy')}: </span>{actorName(viewRecord, viewRecord.approvedById)}</div>}
              {viewRecord.approvedAt && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.approvedAt')}: </span>{new Date(viewRecord.approvedAt).toLocaleString()}</div>}
              {actorName(viewRecord, viewRecord.rejectedById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.rejectedBy')}: </span>{actorName(viewRecord, viewRecord.rejectedById)}</div>}
              {viewRecord.rejectedAt && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.rejectedAt')}: </span>{new Date(viewRecord.rejectedAt).toLocaleString()}</div>}
              {actorName(viewRecord, viewRecord.postedById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.postedBy')}: </span>{actorName(viewRecord, viewRecord.postedById)}</div>}
              {viewRecord.postedAt && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.postedAt')}: </span>{new Date(viewRecord.postedAt).toLocaleString()}</div>}
              {actorName(viewRecord, viewRecord.cancelledById) && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.cancelledBy')}: </span>{actorName(viewRecord, viewRecord.cancelledById)}</div>}
              {viewRecord.cancelledAt && <div><span className="text-gray-500">{t('inventory.finishedGoodsIssue.cancelledAt')}: </span>{new Date(viewRecord.cancelledAt).toLocaleString()}</div>}
              {viewRecord.rejectionReason && <div className="col-span-2"><span className="text-gray-500">{t('inventory.finishedGoodsIssue.reason')}: </span>{viewRecord.rejectionReason}</div>}
              {viewRecord.approvalCancellationReason && <div className="col-span-2"><span className="text-gray-500">{t('inventory.finishedGoodsIssue.reason')}: </span>{viewRecord.approvalCancellationReason}</div>}
            </div>
            {viewRecord.purpose && <p className="text-sm text-gray-600"><span className="text-gray-500">{t('inventory.finishedGoodsIssue.purpose')}: </span>{viewRecord.purpose}</p>}
            {viewRecord.notes && <p className="text-sm text-gray-600"><span className="text-gray-500">{t('inventory.finishedGoodsIssue.notes')}: </span>{viewRecord.notes}</p>}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('inventory.finishedGoodsIssue.movement')}</h4>
              <p className="text-sm text-gray-600" dir="ltr">
                {viewRecord.movementNumber || viewRecord.movement?.movementNumber || '-'}
                {viewRecord.movement ? ` (${viewRecord.movement.movementType} - ${viewRecord.movement.status})` : ''}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('inventory.finishedGoodsIssue.linesTitle')}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pe-3">#</th>
                      <th className="py-2 pe-3">{t('inventory.finishedGoodsIssue.product')}</th>
                      <th className="py-2 pe-3">{t('inventory.finishedGoodsIssue.quantity')}</th>
                      <th className="py-2 pe-3">{t('inventory.finishedGoodsIssue.unit')}</th>
                      <th className="py-2 pe-3">{t('inventory.finishedGoodsIssue.warehouseLocation')}</th>
                      <th className="py-2">{t('inventory.finishedGoodsIssue.batchNumber')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewRecord.lines || []).map((line: FinishedGoodsIssueLine, index: number) => (
                      <tr key={line.id || index} className="border-b border-gray-100">
                        <td className="py-2 pe-3">{index + 1}</td>
                        <td className="py-2 pe-3">{line.product?.name || line.productNameSnapshot || '-'}</td>
                        <td className="py-2 pe-3" dir="ltr">{String(line.quantity)}</td>
                        <td className="py-2 pe-3" dir="ltr">{line.unit}</td>
                        <td className="py-2 pe-3">{line.warehouseLocation?.name || '-'}</td>
                        <td className="py-2" dir="ltr">{line.batchNumber || line.serialNumber || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('inventory.finishedGoodsIssue.history')}</h4>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">{t('inventory.finishedGoodsIssue.noHistory')}</p>
              ) : (
                <ul className="space-y-1 text-sm text-gray-600">
                  {history.map((log) => (
                    <li key={log.id} className="flex gap-2">
                      <span className="font-medium" dir="ltr">{log.action}</span>
                      <span>{log.user?.name ? `- ${log.user.name}` : ''}</span>
                      <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-gray-500">{t('inventory.finishedGoodsIssue.errors.notFound')}</p>
        )}
      </Modal>

      {/* Lifecycle confirmations */}
      <ConfirmDialog
        open={action === 'submit'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleSubmit}
        title={t('inventory.finishedGoodsIssue.submit')}
        message={t('inventory.finishedGoodsIssue.submitConfirmation')}
        variant="primary"
        loading={saving}
      />

      <ConfirmDialog
        open={action === 'approve'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleApprove}
        title={t('inventory.finishedGoodsIssue.approve')}
        message={t('inventory.finishedGoodsIssue.approveConfirmation')}
        variant="primary"
        loading={saving}
      />

      <ConfirmDialog
        open={action === 'withdraw'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleWithdraw}
        title={t('inventory.finishedGoodsIssue.withdraw')}
        message={t('inventory.finishedGoodsIssue.withdrawConfirmation')}
        variant="primary"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea label={t('inventory.finishedGoodsIssue.withdrawReason')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={action === 'reject'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleReject}
        title={t('inventory.finishedGoodsIssue.reject')}
        message={t('inventory.finishedGoodsIssue.rejectReason')}
        variant="danger"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea
            label={t('inventory.finishedGoodsIssue.rejectReason')}
            value={form.notes}
            onChange={(e) => { setForm({ ...form, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, rejectReason: '' })); }}
            required
          />
          {validationErrors.rejectReason && <p className="mt-1 text-sm text-red-600">{validationErrors.rejectReason}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={action === 'cancelApproval'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleCancelApproval}
        title={t('inventory.finishedGoodsIssue.cancelApproval')}
        message={t('inventory.finishedGoodsIssue.cancelApprovalReason')}
        variant="danger"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea
            label={t('inventory.finishedGoodsIssue.cancelApprovalReason')}
            value={form.notes}
            onChange={(e) => { setForm({ ...form, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, cancelApprovalReason: '' })); }}
            required
          />
          {validationErrors.cancelApprovalReason && <p className="mt-1 text-sm text-red-600">{validationErrors.cancelApprovalReason}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={action === 'post'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handlePost}
        title={t('inventory.finishedGoodsIssue.post')}
        message={t('inventory.finishedGoodsIssue.postConfirmation')}
        variant="primary"
        loading={saving}
      />

      <ConfirmDialog
        open={action === 'cancel'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleCancel}
        title={t('inventory.finishedGoodsIssue.cancel')}
        message={t('inventory.finishedGoodsIssue.cancelConfirmation')}
        variant="danger"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea
            label={t('inventory.finishedGoodsIssue.cancelReason')}
            value={form.notes}
            onChange={(e) => { setForm({ ...form, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, cancelReason: '' })); }}
            required
          />
          {validationErrors.cancelReason && <p className="mt-1 text-sm text-red-600">{validationErrors.cancelReason}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={action === 'reverse'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleReverse}
        title={t('inventory.finishedGoodsIssue.reverse')}
        message={t('inventory.finishedGoodsIssue.reverseConfirmation')}
        variant="primary"
        loading={saving}
      >
        <div className="space-y-3 pt-3">
          <Input label={t('inventory.finishedGoodsIssue.issueDate')} type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          <Textarea label={t('inventory.finishedGoodsIssue.reverseNote')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
