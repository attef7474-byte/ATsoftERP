'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';
import { ProductionMaterialDocument, ProductionMaterialDocumentLine } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productionOrderAdapter, productionRunAdapter, warehouseAdapter } from '../../../../components/f9/lookup-adapters';
import { MaterialLinesEditor, MaterialLineDraft, createEmptyMaterialLine } from './_components/lines-editor';
import { COST_PURPOSE_OVERRIDE_PERMISSION, PRODUCTION_COST_PURPOSE } from '../../../../lib/cost-purpose';

const DOCUMENT_TYPES = ['ISSUE', 'CONSUMPTION', 'RETURN', 'SUBSTITUTION'];
const DOCUMENT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];

function typeLabelKey(value: string): string {
  return 'production.materialDocuments.type' + value;
}

function statusLabelKey(value: string): string {
  return 'production.materialDocuments.status' + value;
}

function sourceLabelKey(value: string): string {
  return 'production.materialDocuments.source' + value;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

type ActionType = 'create' | 'edit' | 'view' | 'post' | 'cancel' | 'reverse';

interface MaterialForm {
  documentType: string;
  productionOrderId: string;
  productionRunId: string;
  issueWarehouseId: string;
  documentDate: string;
  notes: string;
  lines: MaterialLineDraft[];
}

interface PerProductSummary {
  productId: string;
  productName: string;
  consumed: number;
  returned: number;
  net: number;
}

export default function ProductionMaterialDocumentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-material-document:' + action)),
    [isSuperAdmin, permissions],
  );

  const canOverrideCostPurpose = useCallback(
    () => isSuperAdmin || Boolean(permissions?.permissions.includes(COST_PURPOSE_OVERRIDE_PERMISSION)),
    [isSuperAdmin, permissions],
  );

  const [data, setData] = useState<ProductionMaterialDocument[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<ActionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<ProductionMaterialDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; posted: number; netIssued: number; returned: number }>({ total: 0, posted: 0, netIssued: 0, returned: 0 });
  const [perProduct, setPerProduct] = useState<PerProductSummary[]>([]);

  const [form, setForm] = useState<MaterialForm>({
    documentType: 'ISSUE',
    productionOrderId: '',
    productionRunId: '',
    issueWarehouseId: '',
    documentDate: new Date().toISOString().slice(0, 10),
    notes: '',
    lines: [createEmptyMaterialLine()],
  });

  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const resetForm = (preserve?: Partial<MaterialForm>) => {
    setForm({
      documentType: 'ISSUE',
      productionOrderId: '',
      productionRunId: '',
      issueWarehouseId: '',
      documentDate: new Date().toISOString().slice(0, 10),
      notes: '',
      lines: [createEmptyMaterialLine()],
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
      labelKey: 'production.materialDocuments.newDocument',
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
      if (typeFilter) params.documentType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: ProductionMaterialDocument[]; meta: any }>('/production/material-documents', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('production.materialDocuments.errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter, t]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<{ data: ProductionMaterialDocument[]; meta: any }>('/production/material-documents', { params: { limit: 100 } });
      const docs = res.data || [];
      const totals = { total: docs.length, posted: 0, netIssued: 0, returned: 0 };
      const byProduct = new Map<string, { name: string; consumed: number; returned: number }>();
      for (const doc of docs) {
        if (doc.status === 'POSTED') {
          totals.posted += 1;
          const sign = doc.documentType === 'RETURN' ? -1 : 1;
          for (const line of doc.lines || []) {
            const qty = toNumber(line.quantity);
            if (doc.documentType === 'RETURN') {
              totals.returned += qty;
            } else {
              totals.netIssued += qty;
            }
            const entry = byProduct.get(line.productId) || { name: line.product?.name || line.productNameSnapshot || line.productId, consumed: 0, returned: 0 };
            if (doc.documentType === 'RETURN') {
              entry.returned += qty;
            } else {
              entry.consumed += qty;
              if (doc.documentType === 'SUBSTITUTION' && line.substitutedProductId) {
                const subEntry = byProduct.get(line.substitutedProductId) || { name: line.substitutedProduct?.name || line.substitutedProductId, consumed: 0, returned: 0 };
                subEntry.returned += qty;
                byProduct.set(line.substitutedProductId, subEntry);
              }
            }
            entry.consumed = Math.round(entry.consumed * 10000) / 10000;
            entry.returned = Math.round(entry.returned * 10000) / 10000;
            byProduct.set(line.productId, entry);
          }
        }
      }
      setSummary(totals);
      setPerProduct(Array.from(byProduct.entries()).map(([productId, s]) => ({
        productId,
        productName: s.name,
        consumed: s.consumed,
        returned: s.returned,
        net: Math.round((s.consumed - s.returned) * 10000) / 10000,
      })));
    } catch (err) { handleApiError(err); }
  }, [handleApiError]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchSummary(); }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: ProductionMaterialDocument }>(`/production/material-documents/${id}`);
      const fetched = res.data || null;
      setDetail(fetched);
      let logs: any[] = [];
      try {
        const audit = await api.get<{ data: any[] }>('/audit-logs', { params: { entity: 'ProductionMaterialDocument', search: id, limit: 20 } });
        logs = (audit.data || []).filter((l) => l.entityId === id);
      } catch { logs = []; }
      setHistory(logs);
      return fetched;
    } catch (err: any) { handleApiError(err); return null; }
    finally { setDetailLoading(false); }
  }, [handleApiError]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionMaterial.')) {
      handleApiError(err, { message: t('production.materialDocuments.errors.' + key.slice('productionMaterial.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.productionOrderId) errors.productionOrderId = t('production.materialDocuments.errors.orderRequired');
    if (!form.productionRunId) errors.productionRunId = t('production.materialDocuments.errors.runRequired');
    if (form.lines.length === 0) errors.lines = t('production.materialDocuments.errors.lineRequired');
    const lineErrors: string[] = [];
    form.lines.forEach((line) => {
      if (!line.productId) lineErrors.push(t('production.materialDocuments.errors.productRequired'));
      if (!line.quantity || toNumber(line.quantity) <= 0) lineErrors.push(t('production.materialDocuments.errors.quantityPositive'));
      if (!line.unit.trim()) lineErrors.push(t('production.materialDocuments.errors.unitRequired'));
    });
    if (lineErrors.length > 0 && !errors.lines) errors.lines = lineErrors[0];
    if (form.documentType === 'SUBSTITUTION' && form.lines.some((l) => !l.substitutedProductId)) {
      errors.lines = t('production.materialDocuments.errors.substitutionRequiresSubstitute');
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const linesToPayload = (lines: MaterialLineDraft[]) => lines.map((line) => ({
    productId: line.productId,
    quantity: toNumber(line.quantity),
    unit: line.unit.trim(),
    warehouseLocationId: line.warehouseLocationId || undefined,
    batchNumber: line.batchNumber.trim() || undefined,
    serialNumber: line.serialNumber.trim() || undefined,
    expiryDate: line.expiryDate || undefined,
    substitutedProductId: line.substitutedProductId || undefined,
    substitutionReason: line.substitutionReason.trim() || undefined,
    notes: line.notes.trim() || undefined,
    costPurpose: (line.costPurpose || PRODUCTION_COST_PURPOSE) as any,
    costPurposeOverrideReason: line.costPurposeOverrideReason.trim() || undefined,
  }));

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        documentType: form.documentType,
        productionOrderId: form.productionOrderId,
        productionRunId: form.productionRunId,
        issueWarehouseId: form.issueWarehouseId || undefined,
        documentDate: form.documentDate || undefined,
        notes: form.notes || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.post('/production/material-documents', payload);
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
        documentDate: form.documentDate || undefined,
        notes: form.notes || undefined,
        lines: linesToPayload(form.lines),
      };
      await api.patch(`/production/material-documents/${detail.id}`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.patch(`/production/material-documents/${selectedId}/post`);
      showToast(t('common.saved'), 'success');
      setAction(null); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!selectedId) return;
    const errors: Record<string, string> = {};
    if (!form.notes.trim()) errors.cancelReason = t('production.materialDocuments.cancelReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/production/material-documents/${selectedId}/cancel`, { reason: form.notes.trim() });
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
        documentDate: form.documentDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      await api.post(`/production/material-documents/${selectedId}/reverse`, payload);
      showToast(t('common.saved'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page); fetchSummary();
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const openCreate = () => { resetForm(); setAction('create'); };

  const openEdit = async (doc: ProductionMaterialDocument) => {
    setSelectedId(doc.id);
    const current = await loadDetail(doc.id);
    const source = current || doc;
    setForm({
      documentType: source.documentType,
      productionOrderId: source.productionOrderId,
      productionRunId: source.productionRunId,
      issueWarehouseId: source.issueWarehouseId || '',
      documentDate: (source.documentDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
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
        substitutedProductId: line.substitutedProductId || '',
        substitutionReason: line.substitutionReason || '',
        notes: line.notes || '',
        costPurpose: (line as any).costPurpose || PRODUCTION_COST_PURPOSE,
        costPurposeOverrideReason: (line as any).costPurposeOverrideReason || '',
      })),
    });
    setValidationErrors({});
    setAction('edit');
  };

  const openView = async (doc: ProductionMaterialDocument) => {
    setSelectedId(doc.id);
    await loadDetail(doc.id);
    setAction('view');
  };

  const openPost = (doc: ProductionMaterialDocument) => { setSelectedId(doc.id); resetForm(); setAction('post'); };

  const openCancel = (doc: ProductionMaterialDocument) => { setSelectedId(doc.id); resetForm(); setAction('cancel'); };

  const openReverse = (doc: ProductionMaterialDocument) => {
    setSelectedId(doc.id);
    resetForm({ documentDate: new Date().toISOString().slice(0, 10) });
    setAction('reverse');
  };

  const columns: GridColumn<ProductionMaterialDocument>[] = [
    { key: 'documentNumber', header: t('production.materialDocuments.documentNumber'), render: (d) => <span className="font-medium">{d.documentNumber}</span> },
    { key: 'documentType', header: t('production.materialDocuments.documentType'), render: (d) => t(typeLabelKey(d.documentType)) },
    { key: 'order', header: t('production.materialDocuments.order'), render: (d) => d.productionOrder?.orderNumber || '-' },
    { key: 'run', header: t('production.materialDocuments.run'), render: (d) => d.productionRun?.runNumber || '-' },
    { key: 'warehouse', header: t('production.materialDocuments.issueWarehouse'), render: (d) => d.issueWarehouse?.name || '-' },
    { key: 'movementNumber', header: t('production.materialDocuments.movementNumber'), render: (d) => d.movementNumber || '-' },
    { key: 'documentDate', header: t('production.materialDocuments.documentDate'), render: (d) => new Date(d.documentDate).toLocaleDateString() },
    { key: 'source', header: t('production.materialDocuments.source'), render: (d) => t(sourceLabelKey(d.sourceType || 'MANUAL')) },
    { key: 'status', header: t('production.materialDocuments.status'), render: (d) => <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{t(statusLabelKey(d.status))}</span> },
  ];

  const gridActions: GridAction<ProductionMaterialDocument>[] = [
    { label: t('common.view'), onClick: (d) => void openView(d), enabled: (d) => can('read') },
    { label: t('common.edit'), onClick: (d) => void openEdit(d), enabled: (d) => can('update') && d.status === 'DRAFT' },
    { label: t('production.materialDocuments.post'), onClick: (d) => openPost(d), enabled: (d) => can('post') && d.status === 'DRAFT' },
    { label: t('production.materialDocuments.cancel'), onClick: (d) => openCancel(d), enabled: (d) => can('cancel') && d.status === 'DRAFT', variant: 'danger' },
    { label: t('production.materialDocuments.reverse'), onClick: (d) => openReverse(d), enabled: (d) => can('reverse') && d.status === 'POSTED' },
  ];

  const performAction = async () => {
    if (action === 'create') await handleCreate();
    if (action === 'edit') await handleUpdate();
    if (action === 'post') await handlePost();
    if (action === 'cancel') await handleCancel();
    if (action === 'reverse') await handleReverse();
  };

  const viewRecord = detail || selectedRecord;

  return (
    <div>
      <PageHeader title={t('production.materialDocuments.title')} />
      <p className="mb-4 text-sm text-gray-500">{t('production.materialDocuments.subtitle')}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.materialDocuments.summary')} - {t('production.materialDocuments.totalDocuments')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.materialDocuments.postedCount')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.posted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.materialDocuments.netIssued')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.netIssued}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{t('production.materialDocuments.returned')}</p>
          <p className="mt-1 text-lg font-semibold" dir="ltr">{summary.returned}</p>
        </div>
      </div>

      {perProduct.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('production.materialDocuments.consumptionSummary')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pe-3">{t('production.materialDocuments.product')}</th>
                  <th className="py-2 pe-3">{t('production.materialDocuments.actualConsumption')}</th>
                  <th className="py-2 pe-3">{t('production.materialDocuments.returned')}</th>
                  <th className="py-2">{t('production.materialDocuments.netConsumption')}</th>
                </tr>
              </thead>
              <tbody>
                {perProduct.map((row) => (
                  <tr key={row.productId} className="border-b border-gray-100">
                    <td className="py-2 pe-3">{row.productName}</td>
                    <td className="py-2 pe-3" dir="ltr">{row.consumed}</td>
                    <td className="py-2 pe-3" dir="ltr">{row.returned}</td>
                    <td className="py-2 font-medium" dir="ltr">{row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('production.materialDocuments.correctionWorkflow')}</p>
        </div>
      )}

      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder={t('production.materialDocuments.allTypes')}
          options={DOCUMENT_TYPES.map((value) => ({ value, label: t(typeLabelKey(value)) }))}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.materialDocuments.allStatuses')}
          options={DOCUMENT_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
      </div>

      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(d) => d.id}
        onRowClick={(d) => setSelectedId(d.id)}
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
        title={action === 'edit' ? t('production.materialDocuments.editDocument') : t('production.materialDocuments.newDocument')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select
                label={t('production.materialDocuments.documentType')}
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                options={DOCUMENT_TYPES.map((value) => ({ value, label: t(typeLabelKey(value)) }))}
              />
            </div>
            <div>
              <Input label={t('production.materialDocuments.documentDate')} type="date" value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup
                label={t('production.materialDocuments.order')}
                value={form.productionOrderId}
                adapter={productionOrderAdapter}
                onChange={(v) => { setForm({ ...form, productionOrderId: v }); setValidationErrors(prev => ({ ...prev, productionOrderId: '' })); }}
              />
              {validationErrors.productionOrderId && <p className="mt-1 text-sm text-red-600">{validationErrors.productionOrderId}</p>}
            </div>
            <div>
              <F9Lookup
                label={t('production.materialDocuments.run')}
                value={form.productionRunId}
                adapter={productionRunAdapter}
                onChange={(v) => { setForm({ ...form, productionRunId: v }); setValidationErrors(prev => ({ ...prev, productionRunId: '' })); }}
              />
              {validationErrors.productionRunId && <p className="mt-1 text-sm text-red-600">{validationErrors.productionRunId}</p>}
            </div>
            <div className="col-span-2">
              <F9Lookup
                label={t('production.materialDocuments.issueWarehouse')}
                value={form.issueWarehouseId}
                adapter={warehouseAdapter}
                onChange={(v) => setForm({ ...form, issueWarehouseId: v })}
              />
            </div>
          </div>
          <MaterialLinesEditor
            lines={form.lines}
            onChange={(lines) => { setForm({ ...form, lines }); setValidationErrors(prev => ({ ...prev, lines: '' })); }}
            showSubstitution={form.documentType === 'SUBSTITUTION'}
            allowOverride={canOverrideCostPurpose()}
            error={validationErrors.lines}
          />
          <Textarea label={t('production.materialDocuments.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
        title={t('production.materialDocuments.detail')}
        size="lg"
      >
        {detailLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">{t('common.loading')}</p>
        ) : viewRecord ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('production.materialDocuments.documentNumber')}: </span><span className="font-medium" dir="ltr">{viewRecord.documentNumber}</span></div>
              <div><span className="text-gray-500">{t('production.materialDocuments.documentType')}: </span>{t(typeLabelKey(viewRecord.documentType))}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.order')}: </span>{viewRecord.productionOrder?.orderNumber || '-'}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.run')}: </span>{viewRecord.productionRun?.runNumber || '-'}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.issueWarehouse')}: </span>{viewRecord.issueWarehouse?.name || '-'}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.status')}: </span>{t(statusLabelKey(viewRecord.status))}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.documentDate')}: </span>{new Date(viewRecord.documentDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.source')}: </span>{t(sourceLabelKey(viewRecord.sourceType || 'MANUAL'))}</div>
              <div><span className="text-gray-500">{t('production.materialDocuments.createdBy')}: </span><span dir="ltr">{viewRecord.createdById || '-'}</span></div>
              <div><span className="text-gray-500">{t('production.materialDocuments.postedBy')}: </span><span dir="ltr">{viewRecord.postedById || '-'}</span></div>
              {viewRecord.postedAt && <div><span className="text-gray-500">{t('production.materialDocuments.postedAt')}: </span>{new Date(viewRecord.postedAt).toLocaleString()}</div>}
              {viewRecord.cancelledById && <div><span className="text-gray-500">{t('production.materialDocuments.cancelledBy')}: </span><span dir="ltr">{viewRecord.cancelledById}</span></div>}
              {viewRecord.cancelledAt && <div><span className="text-gray-500">{t('production.materialDocuments.cancelledAt')}: </span>{new Date(viewRecord.cancelledAt).toLocaleString()}</div>}
            </div>
            {viewRecord.notes && <p className="text-sm text-gray-600"><span className="text-gray-500">{t('production.materialDocuments.notes')}: </span>{viewRecord.notes}</p>}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.materialDocuments.movement')}</h4>
              <p className="text-sm text-gray-600" dir="ltr">
                {viewRecord.movementNumber || viewRecord.movement?.movementNumber || '-'}
                {viewRecord.movement ? ` (${viewRecord.movement.movementType} - ${viewRecord.movement.status})` : ''}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.materialDocuments.linesTitle')}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pe-3">#</th>
                      <th className="py-2 pe-3">{t('production.materialDocuments.product')}</th>
                      <th className="py-2 pe-3">{t('production.materialDocuments.quantity')}</th>
                      <th className="py-2 pe-3">{t('production.materialDocuments.unit')}</th>
                      <th className="py-2 pe-3">{t('production.materialDocuments.warehouseLocation')}</th>
                      <th className="py-2">{t('production.materialDocuments.batchNumber')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewRecord.lines || []).map((line: ProductionMaterialDocumentLine, index: number) => (
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
              <h4 className="mb-2 text-sm font-semibold text-gray-700">{t('production.materialDocuments.history')}</h4>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">{t('production.materialDocuments.noHistory')}</p>
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
          <p className="py-6 text-center text-sm text-gray-500">{t('production.materialDocuments.errors.notFound')}</p>
        )}
      </Modal>

      {/* Post / Cancel / Reverse confirmations */}
      <ConfirmDialog
        open={action === 'post'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handlePost}
        title={t('production.materialDocuments.post')}
        message={t('production.materialDocuments.postConfirmation')}
        variant="primary"
        loading={saving}
      />

      <ConfirmDialog
        open={action === 'cancel'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleCancel}
        title={t('production.materialDocuments.cancel')}
        message={t('production.materialDocuments.cancelConfirmation')}
        variant="danger"
        loading={saving}
      >
        <div className="pt-3">
          <Textarea
            label={t('production.materialDocuments.cancelReason')}
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
        title={t('production.materialDocuments.reverse')}
        message={t('production.materialDocuments.reverseConfirmation')}
        variant="primary"
        loading={saving}
      >
        <div className="space-y-3 pt-3">
          <Input label={t('production.materialDocuments.documentDate')} type="date" value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} />
          <Textarea label={t('production.materialDocuments.reverseNote')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
