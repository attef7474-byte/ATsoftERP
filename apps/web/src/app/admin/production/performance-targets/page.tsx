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
import { machineAdapter, productionLineAdapter, productionProductDefinitionAdapter, productionUnitAdapter } from '../../../../components/f9/lookup-adapters';
import type {
  ProductionPerformanceTarget,
  ProductionPerformanceTargetHistory,
  ProductionPerformanceTargetListResponse,
  ProductionPerformanceTargetScopeType,
  ProductionPerformanceTargetStatus,
} from '../../../../lib/admin-types';

type FormState = {
  scopeType: string;
  productionUnitId: string;
  productionLineId: string;
  machineId: string;
  productionProductDefinitionId: string;
  availabilityTarget: string;
  performanceTarget: string;
  qualityTarget: string;
  oeeTarget: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  scopeType: 'COMPANY',
  productionUnitId: '',
  productionLineId: '',
  machineId: '',
  productionProductDefinitionId: '',
  availabilityTarget: '95',
  performanceTarget: '95',
  qualityTarget: '98',
  oeeTarget: '85',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  notes: '',
});

const SCOPE_OPTIONS: ProductionPerformanceTargetScopeType[] = ['COMPANY', 'BRANCH', 'UNIT', 'LINE', 'MACHINE', 'PRODUCT'];
const STATUS_OPTIONS: ProductionPerformanceTargetStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'INACTIVE'];

const TARGET_ERROR_SUFFIXES = [
  'draftOnly', 'deleteOnlyDraft', 'submitStateInvalid', 'approvalStateInvalid', 'makerCheckerRequired',
  'approvedOverlap', 'deactivationStateInvalid', 'revisionSourceInvalid', 'draftRevisionExists',
  'ambiguousResolution', 'scopeXor', 'scopeTypeInvalid', 'unitInvalid', 'lineInvalid', 'machineInvalid',
  'productInvalid', 'mustBePositive', 'percentageRange', 'notFound', 'invalidEffectiveRange',
];

export default function ProductionPerformanceTargetsPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const can = useCallback((action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`production-performance-target:${action}`)), [isSuperAdmin, permissions]);

  const [data, setData] = useState<ProductionPerformanceTarget[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionPerformanceTarget | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [transition, setTransition] = useState<{ id: string; action: string; reasonRequired: boolean; withNote: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<ProductionPerformanceTargetHistory | null>(null);

  const scopeLabel = useCallback(
    (scope: string): string => {
      switch (scope) {
        case 'COMPANY': return t('production.performanceTargets.scopeLabels.COMPANY');
        case 'BRANCH': return t('production.performanceTargets.scopeLabels.BRANCH');
        case 'UNIT': return t('production.performanceTargets.scopeLabels.UNIT');
        case 'LINE': return t('production.performanceTargets.scopeLabels.LINE');
        case 'MACHINE': return t('production.performanceTargets.scopeLabels.MACHINE');
        case 'PRODUCT': return t('production.performanceTargets.scopeLabels.PRODUCT');
        default: return t('production.performanceTargets.unknownScope');
      }
    },
    [t],
  );

  const scopeReferenceLabel = useCallback(
    (item: ProductionPerformanceTarget): string => {
      if (item.scopeType === 'MACHINE') return item.machine?.name || '-';
      if (item.scopeType === 'LINE') return item.productionLine?.name || '-';
      if (item.scopeType === 'UNIT') return item.productionUnit?.name || '-';
      if (item.scopeType === 'PRODUCT') return item.productionProductDefinition?.name || '-';
      return '-';
    },
    [],
  );

  const statusLabel = useCallback(
    (status: string): string => {
      switch (status) {
        case 'DRAFT': return t('production.performanceTargets.statuses.DRAFT');
        case 'PENDING': return t('production.performanceTargets.statuses.PENDING');
        case 'APPROVED': return t('production.performanceTargets.statuses.APPROVED');
        case 'INACTIVE': return t('production.performanceTargets.statuses.INACTIVE');
        default: return t('production.performanceTargets.unknownStatus');
      }
    },
    [t],
  );

  const transitionActionLabel = useCallback(
    (action: string): string => {
      switch (action) {
        case 'SUBMIT': return t('production.performanceTargets.transitionActions.SUBMIT');
        case 'APPROVE': return t('production.performanceTargets.transitionActions.APPROVE');
        case 'REVISE': return t('production.performanceTargets.transitionActions.REVISE');
        case 'DEACTIVATE': return t('production.performanceTargets.transitionActions.DEACTIVATE');
        default: return t('production.performanceTargets.unknownAction');
      }
    },
    [t],
  );

  const handleTargetError = useCallback(
    (err: any) => {
      const code = err?.errors?.[0]?.code ?? err?.messageKey;
      if (typeof code === 'string' && code.startsWith('performanceTarget.')) {
        const suffix = code.replace('performanceTarget.', '');
        if (TARGET_ERROR_SUFFIXES.includes(suffix)) {
          const localKey = 'production.performanceTargets.' + (suffix === 'invalidEffectiveRange' ? 'invalidEffectiveRange' : 'errors.' + suffix);
          showToast(t(localKey), 'error');
          return;
        }
      }
      handleApiError(err);
    },
    [handleApiError, showToast, t],
  );

  const fetchData = useCallback(async (page = 1) => {
    if (!can('read')) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (scopeFilter) params.scopeType = scopeFilter;
      const result = await api.get<ProductionPerformanceTargetListResponse>('/production/performance-targets', { params });
      setData(result.data || []); setMeta(result.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [can, search, status, scopeFilter, t]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const openCreate = () => { setEditItem(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = async (id: string) => {
    setSaving(true); setModalOpen(true);
    try {
      const item = await api.get<ProductionPerformanceTarget>(`/production/performance-targets/${id}`);
      setEditItem(item);
      setForm({
        scopeType: item.scopeType,
        productionUnitId: item.productionUnitId || '',
        productionLineId: item.productionLineId || '',
        machineId: item.machineId || '',
        productionProductDefinitionId: item.productionProductDefinitionId || '',
        availabilityTarget: item.availabilityTarget,
        performanceTarget: item.performanceTarget,
        qualityTarget: item.qualityTarget,
        oeeTarget: item.oeeTarget,
        effectiveFrom: item.effectiveFrom.slice(0, 10),
        effectiveTo: item.effectiveTo?.slice(0, 10) || '',
        notes: item.notes || '',
      });
    } catch (err) { handleTargetError(err); setModalOpen(false); }
    finally { setSaving(false); }
  };

  const payloadFrom = (source: FormState) => ({
    scopeType: source.scopeType,
    productionUnitId: source.productionUnitId || undefined,
    productionLineId: source.productionLineId || undefined,
    machineId: source.machineId || undefined,
    productionProductDefinitionId: source.productionProductDefinitionId || undefined,
    availabilityTarget: source.availabilityTarget,
    performanceTarget: source.performanceTarget,
    qualityTarget: source.qualityTarget,
    oeeTarget: source.oeeTarget,
    effectiveFrom: new Date(`${source.effectiveFrom}T00:00:00.000Z`).toISOString(),
    effectiveTo: source.effectiveTo ? new Date(`${source.effectiveTo}T00:00:00.000Z`).toISOString() : undefined,
    notes: source.notes || undefined,
  });

  const validateForm = (): string | null => {
    if (!['COMPANY', 'BRANCH', 'UNIT', 'LINE', 'MACHINE', 'PRODUCT'].includes(form.scopeType)) return t('production.performanceTargets.errors.scopeTypeInvalid');
    const dimensionRequired: Record<string, string> = {
      UNIT: form.productionUnitId,
      LINE: form.productionLineId,
      MACHINE: form.machineId,
      PRODUCT: form.productionProductDefinitionId,
    };
    if (dimensionRequired[form.scopeType] === '') return t('production.performanceTargets.errors.scopeXor');
    const targets = [form.availabilityTarget, form.performanceTarget, form.qualityTarget, form.oeeTarget];
    for (const value of targets) {
      const numeric = Number(value);
      if (value === '' || Number.isNaN(numeric) || numeric <= 0) return t('production.performanceTargets.errors.mustBePositive');
      if (numeric > 100) return t('production.performanceTargets.errors.percentageRange');
    }
    if (!form.effectiveFrom) return t('validation.required');
    if (form.effectiveTo && form.effectiveTo <= form.effectiveFrom) return t('production.performanceTargets.invalidEffectiveRange');
    return null;
  };

  const save = async () => {
    const validationError = validateForm();
    if (validationError) { showToast(validationError, 'error'); return; }
    setSaving(true);
    try {
      if (editItem) await api.patch(`/production/performance-targets/${editItem.id}`, payloadFrom(form));
      else await api.post('/production/performance-targets', payloadFrom(form));
      showToast(t(editItem ? 'production.performanceTargets.updated' : 'production.performanceTargets.created'), 'success');
      setModalOpen(false); await fetchData(meta.page);
    } catch (err) { handleTargetError(err); }
    finally { setSaving(false); }
  };

  const runTransition = async () => {
    if (!transition || (transition.reasonRequired && reason.trim().length < 3)) return;
    setSaving(true);
    try {
      if (transition.action === 'delete') {
        await api.delete(`/production/performance-targets/${transition.id}`);
        showToast(t('production.performanceTargets.deleted'), 'success');
      } else {
        const body: Record<string, string> = {};
        if (transition.reasonRequired) body.reason = reason;
        if (transition.withNote && note) body.approvalNote = note;
        await api.post(`/production/performance-targets/${transition.id}/${transition.action}`, body);
        const successKey: Record<string, string> = {
          submit: 'production.performanceTargets.submitted',
          approve: 'production.performanceTargets.approved',
          revise: 'production.performanceTargets.revised',
          deactivate: 'production.performanceTargets.deactivated',
        };
        showToast(t(successKey[transition.action] || 'production.performanceTargets.actionCompleted'), 'success');
      }
      setTransition(null); setReason(''); setNote(''); await fetchData(meta.page);
    } catch (err) { handleTargetError(err); }
    finally { setSaving(false); }
  };

  const showHistory = async (id: string) => {
    try { setHistory(await api.get<ProductionPerformanceTargetHistory>(`/production/performance-targets/${id}/history`)); }
    catch (err) { handleTargetError(err); }
  };

  const columns: GridColumn<ProductionPerformanceTarget>[] = [
    { key: 'code', header: t('production.performanceTargets.targetCode'), render: (item) => `${item.code} / ${item.revision}` },
    { key: 'scopeType', header: t('production.performanceTargets.scopeType'), render: (item) => scopeLabel(item.scopeType) },
    { key: 'scopeRef', header: t('production.product'), render: (item) => scopeReferenceLabel(item) },
    {
      key: 'targets', header: t('production.analytics.oee'), render: (item) => (
        <span dir="ltr">
          A {item.availabilityTarget}% · P {item.performanceTarget}% · Q {item.qualityTarget}% · OEE {item.oeeTarget}%
        </span>
      ),
    },
    { key: 'effectiveFrom', header: t('production.performanceTargets.effectiveFrom'), render: (item) => new Date(item.effectiveFrom).toLocaleDateString() },
    { key: 'status', header: t('common.status'), render: (item) => <CmmsStatusBadge status={item.status} /> },
  ];

  const actions: GridAction<ProductionPerformanceTarget>[] = [
    { label: t('actions.edit'), onClick: (item) => openEdit(item.id), enabled: (item) => can('update') && item.status === 'DRAFT' },
    { label: t('production.performanceTargets.submit'), onClick: (item) => setTransition({ id: item.id, action: 'submit', reasonRequired: false, withNote: false }), enabled: (item) => can('submit') && item.status === 'DRAFT' },
    { label: t('production.performanceTargets.approve'), onClick: (item) => setTransition({ id: item.id, action: 'approve', reasonRequired: false, withNote: true }), enabled: (item) => can('approve') && item.status === 'PENDING' },
    { label: t('production.performanceTargets.revise'), onClick: (item) => setTransition({ id: item.id, action: 'revise', reasonRequired: false, withNote: false }), enabled: (item) => can('create') && item.status === 'APPROVED' },
    { label: t('production.performanceTargets.deactivate'), onClick: (item) => setTransition({ id: item.id, action: 'deactivate', reasonRequired: true, withNote: false }), enabled: (item) => can('deactivate') && item.status === 'APPROVED', variant: 'danger' },
    { label: t('actions.delete'), onClick: (item) => setTransition({ id: item.id, action: 'delete', reasonRequired: false, withNote: false }), enabled: (item) => can('delete') && item.status === 'DRAFT', variant: 'danger' },
    { label: t('production.performanceTargets.history'), onClick: (item) => showHistory(item.id), enabled: (item) => can('read') },
  ];

  const transitionTitle = useMemo(() => {
    if (!transition) return '';
    const keys: Record<string, string> = {
      submit: 'production.performanceTargets.submitConfirmation',
      approve: 'production.performanceTargets.approveConfirmation',
      revise: 'production.performanceTargets.reviseConfirmation',
      deactivate: 'production.performanceTargets.deactivateConfirmation',
      delete: 'production.performanceTargets.deleteConfirmation',
    };
    return t(keys[transition.action] || 'production.performanceTargets.actionCompleted');
  }, [transition, t]);
  if (!can('read')) return <div><PageHeader title={t('production.performanceTargets.title')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('validation.forbidden')}</div></div>;

  const dimensionField = () => {
    switch (form.scopeType) {
      case 'UNIT':
        return <F9Lookup label={t('production.performanceTargets.selectUnit')} value={form.productionUnitId} adapter={productionUnitAdapter} onChange={(value) => setForm({ ...form, productionUnitId: value })} />;
      case 'LINE':
        return <F9Lookup label={t('production.performanceTargets.selectLine')} value={form.productionLineId} adapter={productionLineAdapter} onChange={(value) => setForm({ ...form, productionLineId: value })} />;
      case 'MACHINE':
        return <F9Lookup label={t('production.performanceTargets.selectMachine')} value={form.machineId} adapter={machineAdapter} onChange={(value) => setForm({ ...form, machineId: value })} />;
      case 'PRODUCT':
        return <F9Lookup label={t('production.performanceTargets.selectProduct')} value={form.productionProductDefinitionId} adapter={productionProductDefinitionAdapter} onChange={(value) => setForm({ ...form, productionProductDefinitionId: value })} />;
      default:
        return null;
    }
  };

  return <div>
    <div className="mb-4 flex items-center justify-between gap-3"><PageHeader title={t('production.performanceTargets.title')} /><div className="flex gap-2">{can('create') && <Button onClick={openCreate}>{t('common.create')}</Button>}</div></div>
    <div className="mb-4 grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('production.performanceTargets.allStatuses')} options={STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value) }))} />
      <Select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} placeholder={t('production.performanceTargets.allScopes')} options={SCOPE_OPTIONS.map((value) => ({ value, label: scopeLabel(value) }))} />
    </div>
    <AdminDataGrid columns={columns} data={data} keyExtractor={(item) => item.id} onRowClick={(item) => setSelectedId(item.id)} selectedKey={selectedId} loading={loading} emptyMessage={t('common.noData')} error={error || undefined} onRetry={() => fetchData(meta.page)} actions={actions} dir={dir} globalSearch={search} onGlobalSearch={setSearch} searchPlaceholder={t('common.search')} onRefresh={() => fetchData(meta.page)} refreshLoading={loading} />
    {data.length > 0 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />}

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.performanceTargets.editTarget') : t('production.performanceTargets.newTarget')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label={t('production.performanceTargets.scopeType')} value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value, productionUnitId: '', productionLineId: '', machineId: '', productionProductDefinitionId: '' })} options={SCOPE_OPTIONS.map((value) => ({ value, label: scopeLabel(value) }))} />
        </div>
        {dimensionField()}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label={t('production.performanceTargets.availabilityTarget')} value={form.availabilityTarget} onChange={(e) => setForm({ ...form, availabilityTarget: e.target.value })} />
          <Input label={t('production.performanceTargets.performanceTarget')} value={form.performanceTarget} onChange={(e) => setForm({ ...form, performanceTarget: e.target.value })} />
          <Input label={t('production.performanceTargets.qualityTarget')} value={form.qualityTarget} onChange={(e) => setForm({ ...form, qualityTarget: e.target.value })} />
          <Input label={t('production.performanceTargets.oeeTarget')} value={form.oeeTarget} onChange={(e) => setForm({ ...form, oeeTarget: e.target.value })} />
          <Input type="date" label={t('production.performanceTargets.effectiveFrom')} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <Input type="date" label={t('production.performanceTargets.effectiveTo')} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
        </div>
        <Textarea label={t('production.performanceTargets.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button><Button onClick={save} loading={saving}>{t('actions.save')}</Button></div>
      </div>
    </Modal>

    <Modal open={Boolean(transition)} onClose={() => setTransition(null)} title={transitionTitle}>
      <div className="space-y-4">
        <p>{transitionTitle}</p>
        {transition?.reasonRequired && <Textarea label={t('production.performanceTargets.deactivationReason')} value={reason} onChange={(e) => setReason(e.target.value)} required />}
        {transition?.withNote && <Textarea label={t('production.performanceTargets.approvalNote')} value={note} onChange={(e) => setNote(e.target.value)} />}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setTransition(null)}>{t('actions.cancel')}</Button><Button onClick={runTransition} loading={saving} disabled={Boolean(transition?.reasonRequired && reason.trim().length < 3)}>{t('actions.confirm')}</Button></div>
      </div>
    </Modal>

    <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={t('production.performanceTargets.history')} size="lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('production.performanceTargets.revision')}</h4>
          {history?.revisions?.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
              <span><strong>{item.code} / {item.revision}</strong> — <CmmsStatusBadge status={item.status} /></span>
              <span dir="ltr">A {item.availabilityTarget}% · P {item.performanceTarget}% · Q {item.qualityTarget}% · OEE {item.oeeTarget}%</span>
              <span className="text-xs text-gray-500">{new Date(item.effectiveFrom).toLocaleDateString()}{item.effectiveTo ? ` → ${new Date(item.effectiveTo).toLocaleDateString()}` : ''}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('production.performanceTargets.transitions')}</h4>
          {history?.transitions?.map((item) => (
            <div key={item.id} className="rounded border p-3 text-sm">
              <span className="font-medium">{transitionActionLabel(item.action)}</span> — {statusLabel(item.fromStatus)} → {statusLabel(item.toStatus)}
              <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}{item.reason ? ` · ${item.reason}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  </div>;
}
