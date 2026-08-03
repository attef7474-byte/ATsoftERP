'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { AdminDataGrid, GridAction, GridColumn } from '../../../../components/admin/admin-data-grid';
import { Button, Input, Modal, PageHeader, Pagination, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { machineAdapter, productionLineAdapter, productionProductDefinitionAdapter } from '../../../../components/f9/lookup-adapters';
import type { ProductionCapacityStandard, ProductionPackaging, ProductionProductDefinition, ProductionVersion } from '../../../../lib/admin-types';

type FormState = {
  productionProductId: string; productionVersionId: string; productionPackagingId: string;
  productionLineId: string; machineId: string; standardRate: string; outputUnit: string;
  timeBasis: string; standardCycleTimeMinutes: string; setupMinutes: string; changeoverMinutes: string;
  cleaningMinutes: string; startupAllowanceMinutes: string; shutdownAllowanceMinutes: string;
  targetEfficiencyPercent: string; expectedYieldPercent: string; sourceType: string;
  sourceReference: string; notes: string; effectiveFrom: string; effectiveTo: string;
};

const emptyForm = (): FormState => ({
  productionProductId: '', productionVersionId: '', productionPackagingId: '', productionLineId: '', machineId: '',
  standardRate: '', outputUnit: 'UNIT', timeBasis: 'HOUR', standardCycleTimeMinutes: '', setupMinutes: '0',
  changeoverMinutes: '0', cleaningMinutes: '0', startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0',
  targetEfficiencyPercent: '100', expectedYieldPercent: '100', sourceType: 'MEASURED', sourceReference: '', notes: '',
  effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '',
});

export default function ProductionCapacityStandardsPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const can = useCallback((action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`production-capacity-standard:${action}`)), [isSuperAdmin, permissions]);
  const [data, setData] = useState<ProductionCapacityStandard[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionCapacityStandard | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [versions, setVersions] = useState<ProductionVersion[]>([]);
  const [packagings, setPackagings] = useState<ProductionPackaging[]>([]);
  const [saving, setSaving] = useState(false);
  const [transition, setTransition] = useState<{ id: string; action: string; reasonRequired: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<any>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({ productionProductId: '', productionVersionId: '', productionPackagingId: '', productionLineId: '', machineId: '', outputUnit: 'UNIT', timeBasis: 'HOUR', requestedAt: new Date().toISOString().slice(0, 10) });
  const [resolved, setResolved] = useState<ProductionCapacityStandard | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    if (!can('read')) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (status) params.status = status;
      const result = await api.get<{ data: ProductionCapacityStandard[]; meta: any }>('/production/capacity-standards', { params });
      setData(result.data || []); setMeta(result.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [can, search, status, t]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const loadProductChildren = async (id: string) => {
    if (!id) { setVersions([]); setPackagings([]); return; }
    try {
      const product = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setVersions(product.versions || []); setPackagings(product.packagings || []);
    } catch (err) { handleApiError(err); setVersions([]); setPackagings([]); }
  };

  const openCreate = () => { setEditItem(null); setForm(emptyForm()); setVersions([]); setPackagings([]); setModalOpen(true); };
  const openEdit = async (id: string) => {
    setSaving(true); setModalOpen(true);
    try {
      const item = await api.get<ProductionCapacityStandard>(`/production/capacity-standards/${id}`);
      setEditItem(item);
      setForm({
        productionProductId: item.productionProductId, productionVersionId: item.productionVersionId || '', productionPackagingId: item.productionPackagingId || '', productionLineId: item.productionLineId, machineId: item.machineId || '',
        standardRate: item.standardRate, outputUnit: item.outputUnit, timeBasis: item.timeBasis, standardCycleTimeMinutes: item.standardCycleTimeMinutes || '', setupMinutes: item.setupMinutes,
        changeoverMinutes: item.changeoverMinutes, cleaningMinutes: item.cleaningMinutes, startupAllowanceMinutes: item.startupAllowanceMinutes, shutdownAllowanceMinutes: item.shutdownAllowanceMinutes,
        targetEfficiencyPercent: item.targetEfficiencyPercent, expectedYieldPercent: item.expectedYieldPercent, sourceType: item.sourceType, sourceReference: item.sourceReference || '', notes: item.notes || '',
        effectiveFrom: item.effectiveFrom.slice(0, 10), effectiveTo: item.effectiveTo?.slice(0, 10) || '',
      });
      await loadProductChildren(item.productionProductId);
    } catch (err) { handleApiError(err); setModalOpen(false); }
    finally { setSaving(false); }
  };

  const payloadFrom = (source: FormState) => ({
    ...source,
    productionVersionId: source.productionVersionId || undefined,
    productionPackagingId: source.productionPackagingId || undefined,
    machineId: source.machineId || undefined,
    standardCycleTimeMinutes: source.standardCycleTimeMinutes || undefined,
    sourceReference: source.sourceReference || undefined,
    notes: source.notes || undefined,
    effectiveFrom: new Date(`${source.effectiveFrom}T00:00:00.000Z`).toISOString(),
    effectiveTo: source.effectiveTo ? new Date(`${source.effectiveTo}T00:00:00.000Z`).toISOString() : undefined,
  });

  const save = async () => {
    if (!form.productionProductId || !form.productionLineId || !form.standardRate || !form.effectiveFrom) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      if (editItem) await api.patch(`/production/capacity-standards/${editItem.id}`, payloadFrom(form));
      else await api.post('/production/capacity-standards', payloadFrom(form));
      showToast(t(editItem ? 'common.successUpdated' : 'common.successCreated'), 'success');
      setModalOpen(false); await fetchData(meta.page);
    } catch (err) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const runTransition = async () => {
    if (!transition || (transition.reasonRequired && reason.trim().length < 3)) return;
    setSaving(true);
    try {
      await api.post(`/production/capacity-standards/${transition.id}/${transition.action}`, transition.reasonRequired ? { reason } : {});
      showToast(t('production.capacityActionCompleted'), 'success');
      setTransition(null); setReason(''); await fetchData(meta.page);
    } catch (err) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const showHistory = async (id: string) => {
    try { setHistory(await api.get(`/production/capacity-standards/${id}/history`)); }
    catch (err) { handleApiError(err); }
  };

  const doResolve = async () => {
    setSaving(true); setResolved(null);
    try {
      const params = { ...resolveForm, productionVersionId: resolveForm.productionVersionId || undefined, productionPackagingId: resolveForm.productionPackagingId || undefined, machineId: resolveForm.machineId || undefined, requestedAt: new Date(`${resolveForm.requestedAt}T00:00:00.000Z`).toISOString() };
      setResolved(await api.get('/production/capacity-standards/resolve', { params }));
    } catch (err) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionCapacityStandard>[] = [
    { key: 'code', header: t('common.code'), render: (item) => `${item.code} / ${item.revision}` },
    { key: 'product', header: t('production.product'), render: (item) => item.productionProduct?.name || '-' },
    { key: 'line', header: t('production.line'), render: (item) => item.machine?.name || item.productionLine?.name || '-' },
    { key: 'rate', header: t('production.standardRate'), render: (item) => `${item.standardRate} ${t(`production.capacityUnit.${item.outputUnit}`)} / ${t(`production.timeBasis.${item.timeBasis}`)}` },
    { key: 'effectiveFrom', header: t('production.effectiveFrom'), render: (item) => new Date(item.effectiveFrom).toLocaleDateString() },
    { key: 'status', header: t('common.status'), render: (item) => <CmmsStatusBadge status={item.status} /> },
  ];

  const actions: GridAction<ProductionCapacityStandard>[] = [
    { label: t('actions.edit'), onClick: (item) => openEdit(item.id), enabled: (item) => can('update') && item.status === 'DRAFT' },
    { label: t('production.approveCapacity'), onClick: (item) => setTransition({ id: item.id, action: 'approve', reasonRequired: false }), enabled: (item) => can('approve') && item.status === 'DRAFT' },
    { label: t('production.reviseCapacity'), onClick: (item) => setTransition({ id: item.id, action: 'revise', reasonRequired: false }), enabled: (item) => can('update') && ['APPROVED', 'SUSPENDED'].includes(item.status) },
    { label: t('production.suspendCapacity'), onClick: (item) => setTransition({ id: item.id, action: 'suspend', reasonRequired: true }), enabled: (item) => can('suspend') && item.status === 'APPROVED', variant: 'danger' },
    { label: t('production.reactivateCapacity'), onClick: (item) => setTransition({ id: item.id, action: 'reactivate', reasonRequired: false }), enabled: (item) => can('reactivate') && item.status === 'SUSPENDED' },
    { label: t('production.archiveCapacity'), onClick: (item) => setTransition({ id: item.id, action: 'archive', reasonRequired: true }), enabled: (item) => can('archive') && item.status !== 'ARCHIVED', variant: 'danger' },
    { label: t('production.capacityHistory'), onClick: (item) => showHistory(item.id) },
  ];

  if (!can('read')) return <div><PageHeader title={t('production.capacityStandards')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('validation.forbidden')}</div></div>;

  const referenceFields = (state: any, setState: (value: any) => void, resolving = false) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <F9Lookup label={t('production.product')} value={state.productionProductId} adapter={productionProductDefinitionAdapter} onChange={(value) => { setState({ ...state, productionProductId: value, productionVersionId: '', productionPackagingId: '' }); loadProductChildren(value); }} />
      <F9Lookup label={t('production.line')} value={state.productionLineId} adapter={productionLineAdapter} onChange={(value) => setState({ ...state, productionLineId: value, machineId: '' })} />
      <F9Lookup label={t('production.machine')} value={state.machineId} adapter={machineAdapter} filters={state.productionLineId ? { productionLineId: state.productionLineId } : undefined} disabled={!state.productionLineId} onChange={(value) => setState({ ...state, machineId: value })} />
      <Select label={t('production.versionLabel')} value={state.productionVersionId} onChange={(e) => setState({ ...state, productionVersionId: e.target.value })} placeholder={t('production.allVersions')} options={versions.map((v) => ({ value: v.id, label: `${v.versionNumber} - ${v.versionLabel}` }))} />
      <Select label={t('production.packagingType')} value={state.productionPackagingId} onChange={(e) => setState({ ...state, productionPackagingId: e.target.value })} placeholder={t('production.allPackagings')} options={packagings.map((p) => ({ value: p.id, label: `${p.packagingType} (${p.packQuantity})` }))} />
      <Select label={t('production.outputUnit')} value={state.outputUnit} onChange={(e) => setState({ ...state, outputUnit: e.target.value })} options={['PACK','UNIT','KG','TON','LITER','BATCH'].map((value) => ({ value, label: t(`production.capacityUnit.${value}`) }))} />
      <Select label={t('production.capacityTimeBasis')} value={state.timeBasis} onChange={(e) => setState({ ...state, timeBasis: e.target.value })} options={['MINUTE','HOUR'].map((value) => ({ value, label: t(`production.timeBasis.${value}`) }))} />
      {resolving && <Input type="date" label={t('production.resolveDate')} value={state.requestedAt} onChange={(e) => setState({ ...state, requestedAt: e.target.value })} />}
    </div>
  );

  return <div>
    <div className="mb-4 flex items-center justify-between gap-3"><PageHeader title={t('production.capacityStandards')} /><div className="flex gap-2">{can('resolve') && <Button variant="secondary" onClick={() => { setResolved(null); setResolveOpen(true); }}>{t('production.resolveCapacity')}</Button>}{can('create') && <Button onClick={openCreate}>{t('common.create')}</Button>}</div></div>
    <div className="mb-4 max-w-xs"><Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('production.allStatuses')} options={['DRAFT','APPROVED','SUSPENDED','ARCHIVED'].map((value) => ({ value, label: t(`production.capacityStatus.${value}`) }))} /></div>
    <AdminDataGrid columns={columns} data={data} keyExtractor={(item) => item.id} onRowClick={(item) => setSelectedId(item.id)} selectedKey={selectedId} loading={loading} emptyMessage={t('common.noData')} error={error || undefined} onRetry={() => fetchData(meta.page)} actions={actions} dir={dir} globalSearch={search} onGlobalSearch={setSearch} searchPlaceholder={t('common.search')} onRefresh={() => fetchData(meta.page)} refreshLoading={loading} />
    {data.length > 0 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />}

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editCapacityStandard') : t('production.newCapacityStandard')} size="xl">
      <div className="space-y-4">{referenceFields(form, setForm)}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label={t('production.standardRate')} value={form.standardRate} onChange={(e) => setForm({ ...form, standardRate: e.target.value })} />
          <Input label={t('production.standardCycleTime')} value={form.standardCycleTimeMinutes} onChange={(e) => setForm({ ...form, standardCycleTimeMinutes: e.target.value })} />
          <Input label={t('production.targetEfficiency')} value={form.targetEfficiencyPercent} onChange={(e) => setForm({ ...form, targetEfficiencyPercent: e.target.value })} />
          <Input label={t('production.expectedYield')} value={form.expectedYieldPercent} onChange={(e) => setForm({ ...form, expectedYieldPercent: e.target.value })} />
          <Input label={t('production.setupMinutes')} value={form.setupMinutes} onChange={(e) => setForm({ ...form, setupMinutes: e.target.value })} />
          <Input label={t('production.changeoverMinutes')} value={form.changeoverMinutes} onChange={(e) => setForm({ ...form, changeoverMinutes: e.target.value })} />
          <Input label={t('production.cleaningMinutes')} value={form.cleaningMinutes} onChange={(e) => setForm({ ...form, cleaningMinutes: e.target.value })} />
          <Input label={t('production.startupAllowance')} value={form.startupAllowanceMinutes} onChange={(e) => setForm({ ...form, startupAllowanceMinutes: e.target.value })} />
          <Input label={t('production.shutdownAllowance')} value={form.shutdownAllowanceMinutes} onChange={(e) => setForm({ ...form, shutdownAllowanceMinutes: e.target.value })} />
          <Input type="date" label={t('production.effectiveFrom')} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <Input type="date" label={t('production.effectiveTo')} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          <Select label={t('production.sourceType')} value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} options={['MEASURED','ENGINEERING','SUPPLIER','HISTORICAL','OWNER_OVERRIDE'].map((value) => ({ value, label: t(`production.capacitySource.${value}`) }))} />
        </div>
        <Input label={t('production.sourceReference')} value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })} />
        <Textarea label={t('production.capacityNotes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button><Button onClick={save} loading={saving}>{t('actions.save')}</Button></div>
      </div>
    </Modal>

    <Modal open={Boolean(transition)} onClose={() => setTransition(null)} title={t(`production.capacityAction.${transition?.action || 'approve'}`)}>
      <div className="space-y-4"><p>{t('production.capacityActionConfirmation')}</p>{transition?.reasonRequired && <Textarea label={t('production.transitionReason')} value={reason} onChange={(e) => setReason(e.target.value)} required />}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setTransition(null)}>{t('actions.cancel')}</Button><Button onClick={runTransition} loading={saving} disabled={Boolean(transition?.reasonRequired && reason.trim().length < 3)}>{t('actions.confirm')}</Button></div></div>
    </Modal>

    <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={t('production.capacityHistory')} size="lg"><div className="space-y-3">{history?.revisions?.map((item: ProductionCapacityStandard) => <div key={item.id} className="rounded border p-3"><strong>{item.code} / {item.revision}</strong> — {t(`production.capacityStatus.${item.status}`)}<div className="text-sm text-gray-600">{item.standardRate} {t(`production.capacityUnit.${item.outputUnit}`)} / {t(`production.timeBasis.${item.timeBasis}`)}</div></div>)}</div></Modal>

    <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title={t('production.resolveCapacity')} size="lg"><div className="space-y-4">{referenceFields(resolveForm, setResolveForm, true)}<Button onClick={doResolve} loading={saving}>{t('production.resolveCapacity')}</Button>{resolved && <div className="rounded border border-green-200 bg-green-50 p-4"><div className="font-semibold">{resolved.code} / {resolved.revision} — {resolved.matchedScope}</div><div>{resolved.standardRate} {t(`production.capacityUnit.${resolved.outputUnit}`)} / {t(`production.timeBasis.${resolved.timeBasis}`)}</div><div>{t('production.targetEfficiency')}: {resolved.targetEfficiencyPercent}% · {t('production.expectedYield')}: {resolved.expectedYieldPercent}%</div></div>}</div></Modal>
  </div>;
}
