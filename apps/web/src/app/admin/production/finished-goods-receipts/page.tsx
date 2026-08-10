'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';
import { ProductionFinishedGoodsReceipt, ProductionFinishedGoodsReceiptLine } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productionOrderAdapter, productionRunAdapter, warehouseAdapter } from '../../../../components/f9/lookup-adapters';
import { ReceiptLinesEditor, ReceiptLineDraft, createEmptyReceiptLine } from './_components/lines-editor';

const RECEIPT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];

function statusLabelKey(value: string): string {
  return 'production.finishedGoodsReceipts.status' + value;
}

function sourceLabelKey(value: string): string {
  return 'production.finishedGoodsReceipts.source' + value;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

type ActionType = 'create' | 'edit' | 'view' | 'post' | 'cancel' | 'reverse';

interface ReceiptForm {
  productionOrderId: string;
  productionRunId: string;
  receiptWarehouseId: string;
  receiptDate: string;
  notes: string;
  lines: ReceiptLineDraft[];
}

export default function ProductionFinishedGoodsReceiptsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-finished-goods-receipt:' + action)),
    [isSuperAdmin, permissions],
  );

  const [data, setData] = useState<ProductionFinishedGoodsReceipt[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<ActionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<ProductionFinishedGoodsReceipt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; posted: number; received: number }>({ total: 0, posted: 0, received: 0 });

  const [eligibleOutput, setEligibleOutput] = useState<number | null>(null);
  const [alreadyReceived, setAlreadyReceived] = useState(0);
  const [runEligibleLoading, setRunEligibleLoading] = useState(false);

  const [form, setForm] = useState<ReceiptForm>({
    productionOrderId: '',
    productionRunId: '',
    receiptWarehouseId: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    notes: '',
    lines: [createEmptyReceiptLine()],
  });

  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const resetForm = (preserve?: Partial<ReceiptForm>) => {
    setForm({
      productionOrderId: '',
      productionRunId: '',
      receiptWarehouseId: '',
      receiptDate: new Date().toISOString().slice(0, 10),
      notes: '',
      lines: [createEmptyReceiptLine()],
      ...preserve,
    });
    setValidationErrors({});
    setDetail(null);
    setEligibleOutput(null);
    setAlreadyReceived(0);
  };

  const { exec } = useStableHandlers({
    new: () => { resetForm(); setAction('create'); },
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    {
      id: 'new',
      labelKey: 'production.finishedGoodsReceipts.newReceipt',
      icon: <ActionAddIcon />,
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
      const res = await api.get<{ data: ProductionFinishedGoodsReceipt[]; meta: any }>('/production/finished-goods-receipts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('production.finishedGoodsReceipts.errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, t]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<{ data: ProductionFinishedGoodsReceipt[]; meta: any }>('/production/finished-goods-receipts', { params: { limit: 100 } });
      const receipts = res.data || [];
      const totals = { total: receipts.length, posted: 0, received: 0 };
      for (const receipt of receipts) {
        if (receipt.status === 'POSTED') {
          totals.posted += 1;
          for (const line of receipt.lines || []) totals.received += toNumber(line.quantity);
        }
      }
      setSummary({ ...totals, received: Math.round(totals.received * 10000) / 10000 });
    } catch (err) { handleApiError(err); }
  }, [handleApiError]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchSummary(); }, []);

  const loadRunEligibility = useCallback(async (runId: string) => {
    if (!runId) { setEligibleOutput(null); setAlreadyReceived(0); return; }
    setRunEligibleLoading(true);
    try {
      const live = await api.get<{ totals: { finalOutputTotal?: string | number; finalOutputGood?: string | number } }>(`/production/runs/${runId}/live`);
      setEligibleOutput(toNumber(live.totals?.finalOutputTotal));
      const runReceipts = await api.get<{ data: ProductionFinishedGoodsReceipt[]; meta: any }>('/production/finished-goods-receipts/runs/' + runId, { params: { limit: 100 } });
      let received = 0;
      for (const receipt of runReceipts.data || []) {
        if (receipt.status === 'POSTED') {
          for (const line of receipt.lines || []) received += toNumber(line.quantity);
        }
      }
      setAlreadyReceived(Math.round(received * 10000) / 10000);
    } catch (err) { handleApiError(err); setEligibleOutput(null); setAlreadyReceived(0); }
    finally { setRunEligibleLoading(false); }
  }, [handleApiError]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: ProductionFinishedGoodsReceipt }>(`/production/finished-goods-receipts/${id}`);
      const fetched = res.data || null;
      setDetail(fetched);
      let logs: any[] = [];
      try {
        const audit = await api.get<{ data: any[] }>('/audit-logs', { params: { entity: 'ProductionFinishedGoodsReceipt', search: id, limit: 20 } });
        logs = (audit.data || []).filter((l) => l.entityId === id);
      } catch { logs = []; }
      setHistory(logs);
      return fetched;
    } catch (err: any) { handleApiError(err); return null; }
    finally { setDetailLoading(false); }
  }, [handleApiError]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionFgReceipt.')) {
      handleApiError(err, { message: t('production.finishedGoodsReceipts.errors.' + key.slice('productionFgReceipt.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.productionOrderId) errors.productionOrderId = t('production.finishedGoodsReceipts.errors.orderRequired');
    if (!form.productionRunId) errors.productionRunId = t('production.finishedGoodsReceipts.errors.runRequired');
    if (!form.receiptWarehouseId) errors.receiptWarehouseId = t('production.finishedGoodsReceipts.errors.warehouseRequired');
    if (form.lines.length === 0) errors.lines = t('production.finishedGoodsReceipts.errors.lineRequired');
    const lineErrors: string[] = [];
    form.lines.forEach((line) => {
      if (!line.productId) lineErrors.push(t('production.finishedGoodsReceipts.errors.productRequired'));
      if (!line.quantity || toNumber(line.quantity) <= 0) lineErrors.push(t('production.finishedGoodsReceipts.errors.quantityPositive'));
      if (!line.unit.trim()) lineErrors.push(t('production.finishedGoodsReceipts.errors.unitRequired'));
    });
    if (lineErrors.length > 0 && !errors.lines) errors.lines = lineErrors[0];
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const linesToPayload = (lines: ReceiptLineDraft[]) => lines.map((line) => ({
    productId: line.productId,
    quantity: toNumber(line.quantity),
    unit: line.unit.trim(),
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
        productionOrderId: form.productionOrderId,
        productionRunId: form.productionRunId,
        receiptWarehouseId: form.receiptWarehouseId,
        receiptDate: form.receiptDate || undefined,
        notes: form.notes || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.post('/production/finished-goods-receipts', payload);
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
        receiptDate: form.receiptDate || undefined,
        notes: form.notes || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.patch(`/production/finished-goods-receipts/${detail.id}`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.patch(`/production/finished-goods-receipts/${selectedId}/post`);
      showToast(t('common.saved'), 'success');
      setAction(null); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!selectedId) return;
    const errors: Record<string, string> = {};
    if (!form.notes.trim()) errors.cancelReason = t('production.finishedGoodsReceipts.cancelReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/production/finished-goods-receipts/${selectedId}/cancel`, { reason: form.notes.trim() });
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleReverse = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        receiptDate: form.receiptDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      await api.post(`/production/finished-goods-receipts/${selectedId}/reverse`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const openCreate = () => { resetForm(); setAction('create'); };

  const openEdit = async (receipt: ProductionFinishedGoodsReceipt) => {
    setSelectedId(receipt.id);
    const current = await loadDetail(receipt.id);
    const source = current || receipt;
    setForm({
      productionOrderId: source.productionOrderId,
      productionRunId: source.productionRunId,
      receiptWarehouseId: source.receiptWarehouseId || '',
      receiptDate: (source.receiptDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes: source.notes || '',
      lines: (source.lines || []).map((line) => ({
        key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        productId: line.productId,
        quantity: String(line.quantity),
        unit: line.unit,
        warehouseLocationId: line.warehouseLocationId || '',
        batchNumber: line.batchNumber || '',
        serialNumber: line.serialNumber || '',
        expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
        notes: line.notes || '',
      })),
    });
    setValidationErrors({});
    if (source.productionRunId) void loadRunEligibility(source.productionRunId);
    setAction('edit');
  };

  const openView = async (receipt: ProductionFinishedGoodsReceipt) => {
    setSelectedId(receipt.id);
    await loadDetail(receipt.id);
    setAction('view');
  };

  const openPost = (receipt: ProductionFinishedGoodsReceipt) => { setSelectedId(receipt.id); resetForm(); setAction('post'); };

  const openCancel = (receipt: ProductionFinishedGoodsReceipt) => { setSelectedId(receipt.id); resetForm(); setAction('cancel'); };

  const openReverse = (receipt: ProductionFinishedGoodsReceipt) => {
    setSelectedId(receipt.id);
    resetForm({ receiptDate: new Date().toISOString().slice(0, 10) });
    setAction('reverse');
  };

  const columns: GridColumn<ProductionFinishedGoodsReceipt>[] = [
    { key: 'receiptNumber', header: t('production.finishedGoodsReceipts.receiptNumber'), render: (r) => <span className="font-medium">{r.receiptNumber}</span> },
    { key: 'order', header: t('production.finishedGoodsReceipts.order'), render: (r) => r.productionOrder?.orderNumber || '-' },
    { key: 'run', header: t('production.finishedGoodsReceipts.run'), render: (r) => r.productionRun?.runNumber || '-' },
    { key: 'warehouse', header: t('production.finishedGoodsReceipts.receiptWarehouse'), render: (r) => r.receiptWarehouse?.name || '-' },
    { key: 'movementNumber', header: t('production.finishedGoodsReceipts.movementNumber'), render: (r) => r.movementNumber || '-' },
    { key: 'receiptDate', header: t('production.finishedGoodsReceipts.receiptDate'), render: (r) => new Date(r.receiptDate).toLocaleDateString() },
    { key: 'source', header: t('production.finishedGoodsReceipts.source'), render: (r) => t(sourceLabelKey(r.sourceType || 'MANUAL')) },
    { key: 'status', header: t('production.finishedGoodsReceipts.status'), render: (r) => <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{t(statusLabelKey(r.status))}</span> },
  ];

  const gridActions: GridAction<ProductionFinishedGoodsReceipt>[] = [
    { label: t('common.view'), onClick: (r) => void openView(r), enabled: (r) => can('read') },
    { label: t('common.edit'), onClick: (r) => void openEdit(r), enabled: (r) => can('update') && r.status === 'DRAFT' },
    { label: t('production.finishedGoodsReceipts.post'), onClick: (r) => openPost(r), enabled: (r) => can('post') && r.status === 'DRAFT' },
    { label: t('production.finishedGoodsReceipts.cancel'), onClick: (r) => openCancel(r), enabled: (r) => can('cancel') && r.status === 'DRAFT', variant: 'danger' },
    { label: t('production.finishedGoodsReceipts.reverse'), onClick: (r) => openReverse(r), enabled: (r) => can('reverse') && r.status === 'POSTED' },
  ];

  const performAction = async () => {
    if (action === 'create') await handleCreate();
    if (action === 'edit') await handleUpdate();
    if (action === 'post') await handlePost();
    if (action === 'cancel') await handleCancel();
    if (action === 'reverse') await handleReverse();
  };

  const viewRecord = detail || selectedRecord;
  const remainingReceivable = eligibleOutput !== null ? Math.round((eligibleOutput - alreadyReceived) * 10000) / 10000 : null;

  return (
    <div>
      <PageHeader title={t('production.finishedGoodsReceipts.title')} />
      <p className="mb-4 text-sm text-gray-500">{t('production.finishedGoodsReceipts.subtitle')}</p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.totalReceipts')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.postedCount')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.posted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.receivedQuantity')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.received}</p>
        </div>
      </div>

      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.finishedGoodsReceipts.allStatuses')}
          options={RECEIPT_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
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
        title={action === 'edit' ? t('production.finishedGoodsReceipts.editReceipt') : t('production.finishedGoodsReceipts.newReceipt')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup
                label={t('production.finishedGoodsReceipts.order')}
                value={form.productionOrderId}
                adapter={productionOrderAdapter}
                onChange={(v) => { setForm({ ...form, productionOrderId: v }); setValidationErrors(prev => ({ ...prev, productionOrderId: '' })); }}
              />
              {validationErrors.productionOrderId && <p className="mt-1 text-sm text-red-600">{validationErrors.productionOrderId}</p>}
            </div>
            <div>
              <F9Lookup
                label={t('production.finishedGoodsReceipts.run')}
                value={form.productionRunId}
                adapter={productionRunAdapter}
                onChange={(v) => {
                  setForm({ ...form, productionRunId: v });
                  setValidationErrors(prev => ({ ...prev, productionRunId: '' }));
                  void loadRunEligibility(v);
                }}
              />
              {validationErrors.productionRunId && <p className="mt-1 text-sm text-red-600">{validationErrors.productionRunId}</p>}
            </div>
            <div>
              <F9Lookup
                label={t('production.finishedGoodsReceipts.receiptWarehouse')}
                value={form.receiptWarehouseId}
                adapter={warehouseAdapter}
                onChange={(v) => { setForm({ ...form, receiptWarehouseId: v }); setValidationErrors(prev => ({ ...prev, receiptWarehouseId: '' })); }}
              />
              {validationErrors.receiptWarehouseId && <p className="mt-1 text-sm text-red-600">{validationErrors.receiptWarehouseId}</p>}
            </div>
            <div>
              <Input label={t('production.finishedGoodsReceipts.receiptDate')} type="date" value={form.receiptDate} onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} />
            </div>
          </div>

          {form.productionRunId && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div>
                <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.eligibleOutput')}</p>
                <p className="mt-1 text-base font-semibold" dir="ltr">
                  {runEligibleLoading ? '...' : eligibleOutput !== null ? String(eligibleOutput) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.receivedQuantity')}</p>
                <p className="mt-1 text-base font-semibold" dir="ltr">{runEligibleLoading ? '...' : alreadyReceived}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('production.finishedGoodsReceipts.remainingReceivable')}</p>
                <p className="mt-1 text-base font-semibold" dir="ltr">{runEligibleLoading ? '...' : remainingReceivable !== null ? String(remainingReceivable) : '-'}</p>
              </div>
              <p className="col-span-3 text-xs text-gray-500">{t('production.finishedGoodsReceipts.runOutputHint')}</p>
            </div>
          )}

          <ReceiptLinesEditor
            lines={form.lines}
            onChange={(lines) => { setForm({ ...form, lines }); setValidationErrors(prev => ({ ...prev, lines: '' })); }}
            error={validationErrors.lines}
          />
          <Textarea label={t('production.finishedGoodsReceipts.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
        title={t('production.finishedGoodsReceipts.detail')}
        size="lg"
      >
        {detailLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">{t('common.loading')}</p>
        ) : viewRecord ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.receiptNumber')}: </span><span className="font-medium" dir="ltr">{viewRecord.receiptNumber}</span></div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.status')}: </span>{t(statusLabelKey(viewRecord.status))}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.order')}: </span>{viewRecord.productionOrder?.orderNumber || '-'}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.run')}: </span>{viewRecord.productionRun?.runNumber || '-'}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.receiptWarehouse')}: </span>{viewRecord.receiptWarehouse?.name || '-'}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.receiptDate')}: </span>{new Date(viewRecord.receiptDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.source')}: </span>{t(sourceLabelKey(viewRecord.sourceType || 'MANUAL'))}</div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.createdBy')}: </span><span dir="ltr">{viewRecord.createdById || '-'}</span></div>
              <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.postedBy')}: </span><span dir="ltr">{viewRecord.postedById || '-'}</span></div>
              {viewRecord.postedAt && <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.postedAt')}: </span>{new Date(viewRecord.postedAt).toLocaleString()}</div>}
              {viewRecord.cancelledById && <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.cancelledBy')}: </span><span dir="ltr">{viewRecord.cancelledById}</span></div>}
              {viewRecord.cancelledAt && <div><span className="text-gray-500">{t('production.finishedGoodsReceipts.cancelledAt')}: </span>{new Date(viewRecord.cancelledAt).toLocaleString()}</div>}
            </div>
            {viewRecord.notes && <p className="text-sm text-gray-600"><span className="text-gray-500">{t('production.finishedGoodsReceipts.notes')}: </span>{viewRecord.notes}</p>}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.finishedGoodsReceipts.movement')}</h4>
              <p className="text-sm text-gray-600" dir="ltr">
                {viewRecord.movementNumber || viewRecord.movement?.movementNumber || '-'}
                {viewRecord.movement ? ` (${viewRecord.movement.movementType} - ${viewRecord.movement.status})` : ''}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.finishedGoodsReceipts.linesTitle')}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pe-3">#</th>
                      <th className="py-2 pe-3">{t('production.finishedGoodsReceipts.product')}</th>
                      <th className="py-2 pe-3">{t('production.finishedGoodsReceipts.quantity')}</th>
                      <th className="py-2 pe-3">{t('production.finishedGoodsReceipts.unit')}</th>
                      <th className="py-2 pe-3">{t('production.finishedGoodsReceipts.warehouseLocation')}</th>
                      <th className="py-2">{t('production.finishedGoodsReceipts.batchNumber')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewRecord.lines || []).map((line: ProductionFinishedGoodsReceiptLine, index: number) => (
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
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.finishedGoodsReceipts.history')}</h4>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">{t('production.finishedGoodsReceipts.noHistory')}</p>
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
          <p className="py-6 text-center text-sm text-gray-500">{t('production.finishedGoodsReceipts.errors.notFound')}</p>
        )}
      </Modal>

      {/* Post / Cancel / Reverse confirmations */}
      <ConfirmDialog
        open={action === 'post'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handlePost}
        title={t('production.finishedGoodsReceipts.post')}
        message={t('production.finishedGoodsReceipts.postConfirmation')}
        variant="primary"
        loading={saving}
      />

      <ConfirmDialog
        open={action === 'cancel'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleCancel}
        title={t('production.finishedGoodsReceipts.cancel')}
        message={t('production.finishedGoodsReceipts.cancelConfirmation')}
        variant="danger"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea
            label={t('production.finishedGoodsReceipts.cancelReason')}
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
        title={t('production.finishedGoodsReceipts.reverse')}
        message={t('production.finishedGoodsReceipts.reverseConfirmation')}
        variant="primary"
        loading={saving}
      >
        <div className="space-y-3 pt-3">
          <Input label={t('production.finishedGoodsReceipts.receiptDate')} type="date" value={form.receiptDate} onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} />
          <Textarea label={t('production.finishedGoodsReceipts.reverseNote')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
