'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionQualityPlan, QualityCharacteristic, QualitySamplingPoint, ProductionProductDefinition, ProductionVersion, ProductionPackaging } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionProductDefinitionAdapter, productionLineAdapter, machineAdapter, costCenterAdapter, productionUnitAdapter, productionMeasurementPointAdapter } from '../../../../../components/f9';

const CHARACTERISTIC_TYPES = ['NUMERIC', 'BOOLEAN', 'TEXT', 'CHOICE'];
const CRITICALITY_LEVELS = ['CRITICAL', 'MAJOR', 'MINOR'];
const INSPECTION_STAGES = ['INCOMING', 'IN_PROCESS', 'FINAL_OUTPUT'];

function characteristicTypeLabelKey(value: string): string {
  return 'production.qualityPlans.characteristicType' + value;
}

function criticalityLabelKey(value: string): string {
  return 'production.qualityPlans.criticality' + value;
}

function stageLabelKey(value: string): string {
  return 'production.qualityPlans.stage' + value;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Tab = 'details' | 'characteristics' | 'sampling';

export default function ProductionQualityPlansPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionQualityPlan[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionQualityPlan | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [versions, setVersions] = useState<ProductionVersion[]>([]);
  const [packagings, setPackagings] = useState<ProductionPackaging[]>([]);
  const [form, setForm] = useState({
    productionProductDefinitionId: '',
    productionVersionId: '',
    productionPackagingId: '',
    productionLineId: '',
    machineId: '',
    costCenterId: '',
    effectiveFrom: '',
    effectiveTo: '',
    notes: '',
  });
  const [characteristics, setCharacteristics] = useState<QualityCharacteristic[]>([]);
  const [samplingPoints, setSamplingPoints] = useState<QualitySamplingPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [characteristicModalOpen, setCharacteristicModalOpen] = useState(false);
  const [editCharacteristic, setEditCharacteristic] = useState<QualityCharacteristic | null>(null);
  const [characteristicForm, setCharacteristicForm] = useState({
    nameAr: '', nameEn: '', characteristicType: 'NUMERIC', unit: '', productionUnitId: '',
    lowerLimit: '', targetValue: '', upperLimit: '', criticality: 'MAJOR', samplingRule: '', isRequired: false,
  });

  const [samplingModalOpen, setSamplingModalOpen] = useState(false);
  const [editSampling, setEditSampling] = useState<QualitySamplingPoint | null>(null);
  const [samplingForm, setSamplingForm] = useState({
    stage: 'FINAL_OUTPUT', measurementPointId: '', productionLineId: '', machineId: '',
    appliesToMaterial: false, appliesToFinishedGoods: true, sampleFrequency: '', sampleSize: '', sortOrder: 0,
  });

  const [confirmAction, setConfirmAction] = useState<{ kind: 'submit' | 'approve' | 'reject' | 'deactivate' | 'delete'; id: string; reason?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const loadProductChildren = async (id: string) => {
    if (!id) { setVersions([]); setPackagings([]); return; }
    try {
      const product = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setVersions(product.versions || []); setPackagings(product.packagings || []);
    } catch (err) { handleApiError(err); setVersions([]); setPackagings([]); }
  };

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    submit: () => selectedId && setConfirmAction({ kind: 'submit', id: selectedId }),
    approve: () => selectedId && setConfirmAction({ kind: 'approve', id: selectedId }),
    reject: () => { setReason(''); setConfirmAction({ kind: 'reject', id: selectedId }); },
    deactivate: () => { setReason(''); setConfirmAction({ kind: 'deactivate', id: selectedId }); },
    delete: () => selectedId && setConfirmAction({ kind: 'delete', id: selectedId }),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'submit', labelKey: 'production.qualityPlans.submit', icon: <ActionEditIcon />, onClick: () => exec('submit'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'approve', labelKey: 'production.qualityPlans.approve', icon: <ActionEditIcon />, onClick: () => exec('approve'), enabled: !!(selectedId && selectedRecord?.status === 'PENDING') },
    { id: 'reject', labelKey: 'production.qualityPlans.reject', icon: <ActionEditIcon />, onClick: () => exec('reject'), enabled: !!(selectedId && selectedRecord?.status === 'PENDING') },
    { id: 'deactivate', labelKey: 'production.qualityPlans.deactivate', icon: <ActionEditIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'APPROVED') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: ProductionQualityPlan[]; meta: any }>('/production/quality-plans', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setActiveTab('details');
    setVersions([]); setPackagings([]);
    setForm({
      productionProductDefinitionId: '', productionVersionId: '', productionPackagingId: '',
      productionLineId: '', machineId: '', costCenterId: '',
      effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', notes: '',
    });
    setCharacteristics([]); setSamplingPoints([]);
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionQualityPlan>(`/production/quality-plans/${id}`);
      setEditItem(item);
      setForm({
        productionProductDefinitionId: item.productionProductDefinitionId,
        productionVersionId: item.productionVersionId || '',
        productionPackagingId: item.productionPackagingId || '',
        productionLineId: item.productionLineId || '',
        machineId: item.machineId || '',
        costCenterId: item.costCenterId || '',
        effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        notes: item.notes || '',
      });
      setCharacteristics(item.characteristics || []);
      setSamplingPoints(item.samplingPoints || []);
      await loadProductChildren(item.productionProductDefinitionId);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.productionProductDefinitionId) errors.productionProductDefinitionId = t('production.qualityPlans.errors.productDefinitionRequired');
    if (!form.effectiveFrom) errors.effectiveFrom = t('production.qualityPlans.errors.effectiveFromRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        productionProductDefinitionId: form.productionProductDefinitionId,
        productionVersionId: form.productionVersionId || undefined,
        productionPackagingId: form.productionPackagingId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        costCenterId: form.costCenterId || undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
      };
      if (editItem) {
        await api.patch(`/production/quality-plans/${editItem.id}`, payload);
        showToast(t('production.qualityPlans.updateCompleted'), 'success');
      } else {
        await api.post('/production/quality-plans', payload);
        showToast(t('production.qualityPlans.createCompleted'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Characteristics ────────────────────────────────────────────

  const openCreateCharacteristic = () => {
    setEditCharacteristic(null);
    setCharacteristicForm({
      nameAr: '', nameEn: '', characteristicType: 'NUMERIC', unit: '', productionUnitId: '',
      lowerLimit: '', targetValue: '', upperLimit: '', criticality: 'MAJOR', samplingRule: '', isRequired: false,
    });
    setCharacteristicModalOpen(true);
  };

  const openEditCharacteristic = (c: QualityCharacteristic) => {
    setEditCharacteristic(c);
    setCharacteristicForm({
      nameAr: c.nameAr, nameEn: c.nameEn, characteristicType: c.characteristicType, unit: c.unit || '', productionUnitId: c.productionUnitId || '',
      lowerLimit: c.lowerLimit != null ? String(c.lowerLimit) : '', targetValue: c.targetValue != null ? String(c.targetValue) : '', upperLimit: c.upperLimit != null ? String(c.upperLimit) : '',
      criticality: c.criticality, samplingRule: c.samplingRule || '', isRequired: c.isRequired,
    });
    setCharacteristicModalOpen(true);
  };

  const saveCharacteristic = async () => {
    if (!editItem) return;
    if (!characteristicForm.nameAr || !characteristicForm.nameEn) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nameAr: characteristicForm.nameAr,
        nameEn: characteristicForm.nameEn,
        characteristicType: characteristicForm.characteristicType,
        unit: characteristicForm.unit || undefined,
        productionUnitId: characteristicForm.productionUnitId || undefined,
        lowerLimit: characteristicForm.lowerLimit !== '' ? Number(characteristicForm.lowerLimit) : undefined,
        targetValue: characteristicForm.targetValue !== '' ? Number(characteristicForm.targetValue) : undefined,
        upperLimit: characteristicForm.upperLimit !== '' ? Number(characteristicForm.upperLimit) : undefined,
        criticality: characteristicForm.criticality,
        samplingRule: characteristicForm.samplingRule || undefined,
        isRequired: characteristicForm.isRequired,
      };
      if (editCharacteristic) {
        await api.patch(`/production/quality-plans/${editItem.id}/characteristics/${editCharacteristic.id}`, payload);
        showToast(t('production.qualityPlans.characteristicUpdateCompleted'), 'success');
      } else {
        await api.post(`/production/quality-plans/${editItem.id}/characteristics`, payload);
        showToast(t('production.qualityPlans.characteristicCreateCompleted'), 'success');
      }
      setCharacteristicModalOpen(false);
      const refreshed = await api.get<ProductionQualityPlan>(`/production/quality-plans/${editItem.id}`);
      setCharacteristics(refreshed.characteristics || []);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const deleteCharacteristic = async (id: string) => {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.delete(`/production/quality-plans/${editItem.id}/characteristics/${id}`);
      showToast(t('production.qualityPlans.characteristicDeleteCompleted'), 'success');
      const refreshed = await api.get<ProductionQualityPlan>(`/production/quality-plans/${editItem.id}`);
      setCharacteristics(refreshed.characteristics || []);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Sampling points ────────────────────────────────────────────

  const openCreateSampling = () => {
    setEditSampling(null);
    setSamplingForm({
      stage: 'FINAL_OUTPUT', measurementPointId: '', productionLineId: '', machineId: '',
      appliesToMaterial: false, appliesToFinishedGoods: true, sampleFrequency: '', sampleSize: '', sortOrder: 0,
    });
    setSamplingModalOpen(true);
  };

  const openEditSampling = (s: QualitySamplingPoint) => {
    setEditSampling(s);
    setSamplingForm({
      stage: s.stage, measurementPointId: s.measurementPointId || '', productionLineId: s.productionLineId || '', machineId: s.machineId || '',
      appliesToMaterial: s.appliesToMaterial, appliesToFinishedGoods: s.appliesToFinishedGoods, sampleFrequency: s.sampleFrequency || '',
      sampleSize: s.sampleSize != null ? String(s.sampleSize) : '', sortOrder: s.sortOrder,
    });
    setSamplingModalOpen(true);
  };

  const saveSampling = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const payload: any = {
        stage: samplingForm.stage,
        measurementPointId: samplingForm.measurementPointId || undefined,
        productionLineId: samplingForm.productionLineId || undefined,
        machineId: samplingForm.machineId || undefined,
        appliesToMaterial: samplingForm.appliesToMaterial,
        appliesToFinishedGoods: samplingForm.appliesToFinishedGoods,
        sampleFrequency: samplingForm.sampleFrequency || undefined,
        sampleSize: samplingForm.sampleSize !== '' ? Number(samplingForm.sampleSize) : undefined,
        sortOrder: Number(samplingForm.sortOrder) || 0,
      };
      if (editSampling) {
        await api.patch(`/production/quality-plans/${editItem.id}/sampling-points/${editSampling.id}`, payload);
        showToast(t('production.qualityPlans.samplingPointUpdateCompleted'), 'success');
      } else {
        await api.post(`/production/quality-plans/${editItem.id}/sampling-points`, payload);
        showToast(t('production.qualityPlans.samplingPointCreateCompleted'), 'success');
      }
      setSamplingModalOpen(false);
      const refreshed = await api.get<ProductionQualityPlan>(`/production/quality-plans/${editItem.id}`);
      setSamplingPoints(refreshed.samplingPoints || []);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const deleteSampling = async (id: string) => {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.delete(`/production/quality-plans/${editItem.id}/sampling-points/${id}`);
      showToast(t('production.qualityPlans.samplingPointDeleteCompleted'), 'success');
      const refreshed = await api.get<ProductionQualityPlan>(`/production/quality-plans/${editItem.id}`);
      setSamplingPoints(refreshed.samplingPoints || []);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Status transitions ─────────────────────────────────────────

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    if ((confirmAction.kind === 'reject' || confirmAction.kind === 'deactivate') && !reason) {
      showToast(t('production.qualityPlans.errors.rejectReasonRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      const { kind, id } = confirmAction;
      if (kind === 'submit') await api.patch(`/production/quality-plans/${id}/submit`, {});
      else if (kind === 'approve') await api.patch(`/production/quality-plans/${id}/approve`, {});
      else if (kind === 'reject') await api.patch(`/production/quality-plans/${id}/reject`, { reason });
      else if (kind === 'deactivate') await api.patch(`/production/quality-plans/${id}/deactivate`, { reason });
      else await api.delete(`/production/quality-plans/${id}`);

      const completedKeys: Record<string, string> = {
        submit: 'production.qualityPlans.submitCompleted',
        approve: 'production.qualityPlans.approveCompleted',
        reject: 'production.qualityPlans.rejectCompleted',
        deactivate: 'production.qualityPlans.deactivateCompleted',
        delete: 'production.qualityPlans.deleteCompleted',
      };
      showToast(t(completedKeys[kind]), 'success');
      setConfirmAction(null); setReason(''); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmTitle = () => {
    if (!confirmAction) return '';
    const titles: Record<string, string> = {
      submit: 'production.qualityPlans.submitConfirmation',
      approve: 'production.qualityPlans.approveConfirmation',
      reject: 'production.qualityPlans.rejectConfirmation',
      deactivate: 'production.qualityPlans.deactivateConfirmation',
      delete: 'production.qualityPlans.deleteConfirmation',
    };
    return t(titles[confirmAction.kind]);
  };

  const columns: GridColumn<ProductionQualityPlan>[] = [
    { key: 'code', header: t('production.qualityPlans.code'), render: (r) => `${r.code} / ${r.revision}` },
    { key: 'productDefinition', header: t('production.qualityPlans.productDefinition'), render: (r) => r.productionProductDefinition?.product?.name || r.productionProductDefinition?.code || '-' },
    { key: 'line', header: t('production.qualityPlans.line'), render: (r) => r.productionLine?.name || r.machine?.name || '-' },
    { key: 'effectiveFrom', header: t('production.qualityPlans.effectiveFrom'), render: (r) => new Date(r.effectiveFrom).toLocaleDateString() },
    { key: 'characteristics', header: t('production.qualityPlans.characteristics'), render: (r) => r.characteristics?.length ?? 0 },
    { key: 'samplingPoints', header: t('production.qualityPlans.samplingPoints'), render: (r) => r.samplingPoints?.length ?? 0 },
    { key: 'status', header: t('production.qualityPlans.allStatuses'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<ProductionQualityPlan>[] = [
    { label: t('actions.edit'), onClick: (r) => openEdit(r.id), enabled: (r) => r.status === 'DRAFT' },
    { label: t('production.qualityPlans.submit'), onClick: (r) => { setSelectedId(r.id); setConfirmAction({ kind: 'submit', id: r.id }); }, enabled: (r) => r.status === 'DRAFT' },
    { label: t('production.qualityPlans.approve'), onClick: (r) => { setSelectedId(r.id); setConfirmAction({ kind: 'approve', id: r.id }); }, enabled: (r) => r.status === 'PENDING' },
    { label: t('production.qualityPlans.reject'), onClick: (r) => { setSelectedId(r.id); setReason(''); setConfirmAction({ kind: 'reject', id: r.id }); }, enabled: (r) => r.status === 'PENDING' },
    { label: t('production.qualityPlans.deactivate'), onClick: (r) => { setSelectedId(r.id); setReason(''); setConfirmAction({ kind: 'deactivate', id: r.id }); }, enabled: (r) => r.status === 'APPROVED', variant: 'danger' },
    { label: t('common.delete'), onClick: (r) => { setSelectedId(r.id); setConfirmAction({ kind: 'delete', id: r.id }); }, enabled: (r) => r.status === 'DRAFT', variant: 'danger' },
  ];

  const canManageChildren = !!editItem && (editItem.status === 'DRAFT' || editItem.status === 'PENDING');

  return (
    <div>
      <PageHeader title={t('production.qualityPlans.title')} />
      <div className="mb-4 flex max-w-md gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.qualityPlans.allStatuses')}
          options={[
            { value: 'DRAFT', label: t('production.qualityPlans.statusDRAFT') },
            { value: 'PENDING', label: t('production.qualityPlans.statusPENDING') },
            { value: 'APPROVED', label: t('production.qualityPlans.statusAPPROVED') },
            { value: 'INACTIVE', label: t('production.qualityPlans.statusINACTIVE') },
          ]}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? `${t('production.qualityPlans.editPlan')} ${editItem.code}` : t('production.qualityPlans.newPlan')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div>
            <div className="mb-4 flex gap-2 border-b border-gray-200">
              {(['details', 'characteristics', 'sampling'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'details' ? t('production.qualityPlans.editPlan') : tab === 'characteristics' ? t('production.qualityPlans.characteristics') : t('production.qualityPlans.samplingPoints')}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <F9Lookup
                      label={t('production.qualityPlans.productDefinition')}
                      adapter={productionProductDefinitionAdapter}
                      value={form.productionProductDefinitionId}
                      disabled={!!editItem}
                      onChange={(value) => { setForm({ ...form, productionProductDefinitionId: value, productionVersionId: '', productionPackagingId: '' }); loadProductChildren(value); }}
                    />
                    {validationErrors.productionProductDefinitionId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionProductDefinitionId}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label={t('production.qualityPlans.version')}
                      value={form.productionVersionId}
                      onChange={(e) => setForm({ ...form, productionVersionId: e.target.value })}
                      placeholder={t('common.none')}
                      options={versions.map((v) => ({ value: v.id, label: `${v.versionNumber} - ${v.versionLabel}` }))}
                    />
                    <Select
                      label={t('production.qualityPlans.packaging')}
                      value={form.productionPackagingId}
                      onChange={(e) => setForm({ ...form, productionPackagingId: e.target.value })}
                      placeholder={t('common.none')}
                      options={packagings.map((p) => ({ value: p.id, label: `${p.packagingType} (${p.packQuantity})` }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Input label={t('production.qualityPlans.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} required />
                    {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
                  </div>
                  <div>
                    <Input label={t('production.qualityPlans.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <F9Lookup
                      label={t('production.qualityPlans.line')}
                      adapter={productionLineAdapter}
                      value={form.productionLineId}
                      onChange={(value) => setForm({ ...form, productionLineId: value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <F9Lookup
                    label={t('production.qualityPlans.machine')}
                    adapter={machineAdapter}
                    value={form.machineId}
                    onChange={(value) => setForm({ ...form, machineId: value })}
                  />
                  <F9Lookup
                    label={t('production.qualityPlans.costCenter')}
                    adapter={costCenterAdapter}
                    value={form.costCenterId}
                    onChange={(value) => setForm({ ...form, costCenterId: value })}
                  />
                </div>
                <Textarea label={t('production.qualityPlans.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
                  <Button onClick={handleSave} loading={saving} disabled={!!editItem && editItem.status !== 'DRAFT'}>{t('actions.save')}</Button>
                </div>
              </div>
            )}

            {activeTab === 'characteristics' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={openCreateCharacteristic} disabled={!canManageChildren} size="sm">{t('production.qualityPlans.addCharacteristic')}</Button>
                </div>
                {characteristics.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.nameEn')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.characteristicType')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.criticality')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.lowerLimit')} / {t('production.qualityPlans.upperLimit')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.isRequired')}</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {characteristics.map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2">{c.nameEn} / {c.nameAr}</td>
                            <td className="px-3 py-2">{t(characteristicTypeLabelKey(c.characteristicType))}</td>
                            <td className="px-3 py-2">{t(criticalityLabelKey(c.criticality))}</td>
                            <td className="px-3 py-2">{c.lowerLimit != null ? c.lowerLimit : '-'} / {c.upperLimit != null ? c.upperLimit : '-'}</td>
                            <td className="px-3 py-2">{c.isRequired ? t('common.yes') : t('common.no')}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {canManageChildren && (
                                <>
                                  <button type="button" className="text-blue-600 hover:text-blue-800 mr-3" onClick={() => openEditCharacteristic(c)}>{t('actions.edit')}</button>
                                  <button type="button" className="text-red-600 hover:text-red-800" onClick={() => { if (window.confirm(t('production.qualityPlans.deleteConfirmation'))) deleteCharacteristic(c.id); }}>{t('common.delete')}</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sampling' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={openCreateSampling} disabled={!canManageChildren} size="sm">{t('production.qualityPlans.addSamplingPoint')}</Button>
                </div>
                {samplingPoints.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.stage')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.measurementPoint')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.sampleSize')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.qualityPlans.sortOrder')}</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {samplingPoints.map((s) => (
                          <tr key={s.id}>
                            <td className="px-3 py-2">{t(stageLabelKey(s.stage))}</td>
                            <td className="px-3 py-2">{s.measurementPoint?.name || s.productionLine?.name || s.machine?.name || '-'}</td>
                            <td className="px-3 py-2">{s.sampleSize ?? '-'}</td>
                            <td className="px-3 py-2">{s.sortOrder}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {canManageChildren && (
                                <>
                                  <button type="button" className="text-blue-600 hover:text-blue-800 mr-3" onClick={() => openEditSampling(s)}>{t('actions.edit')}</button>
                                  <button type="button" className="text-red-600 hover:text-red-800" onClick={() => { if (window.confirm(t('production.qualityPlans.deleteConfirmation'))) deleteSampling(s.id); }}>{t('common.delete')}</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={characteristicModalOpen} onClose={() => setCharacteristicModalOpen(false)} title={editCharacteristic ? t('production.qualityPlans.editCharacteristic') : t('production.qualityPlans.addCharacteristic')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.qualityPlans.nameAr')} value={characteristicForm.nameAr} onChange={(e) => setCharacteristicForm({ ...characteristicForm, nameAr: e.target.value })} required />
            <Input label={t('production.qualityPlans.nameEn')} value={characteristicForm.nameEn} onChange={(e) => setCharacteristicForm({ ...characteristicForm, nameEn: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label={t('production.qualityPlans.characteristicType')}
              value={characteristicForm.characteristicType}
              onChange={(e) => setCharacteristicForm({ ...characteristicForm, characteristicType: e.target.value })}
              options={CHARACTERISTIC_TYPES.map((value) => ({ value, label: t(characteristicTypeLabelKey(value)) }))}
            />
            <Select
              label={t('production.qualityPlans.criticality')}
              value={characteristicForm.criticality}
              onChange={(e) => setCharacteristicForm({ ...characteristicForm, criticality: e.target.value })}
              options={CRITICALITY_LEVELS.map((value) => ({ value, label: t(criticalityLabelKey(value)) }))}
            />
            <F9Lookup
              label={t('production.qualityPlans.unit')}
              adapter={productionUnitAdapter}
              value={characteristicForm.productionUnitId}
              onChange={(value) => setCharacteristicForm({ ...characteristicForm, productionUnitId: value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('production.qualityPlans.unit')} placeholder={t('production.qualityPlans.unit')} value={characteristicForm.unit} onChange={(e) => setCharacteristicForm({ ...characteristicForm, unit: e.target.value })} />
            <Input label={t('production.qualityPlans.lowerLimit')} type="number" step="0.0001" value={characteristicForm.lowerLimit} onChange={(e) => setCharacteristicForm({ ...characteristicForm, lowerLimit: e.target.value })} />
            <Input label={t('production.qualityPlans.targetValue')} type="number" step="0.0001" value={characteristicForm.targetValue} onChange={(e) => setCharacteristicForm({ ...characteristicForm, targetValue: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.qualityPlans.upperLimit')} type="number" step="0.0001" value={characteristicForm.upperLimit} onChange={(e) => setCharacteristicForm({ ...characteristicForm, upperLimit: e.target.value })} />
            <Input label={t('production.qualityPlans.samplingRule')} value={characteristicForm.samplingRule} onChange={(e) => setCharacteristicForm({ ...characteristicForm, samplingRule: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={characteristicForm.isRequired} onChange={(e) => setCharacteristicForm({ ...characteristicForm, isRequired: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
            {t('production.qualityPlans.isRequired')}
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCharacteristicModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={saveCharacteristic} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={samplingModalOpen} onClose={() => setSamplingModalOpen(false)} title={editSampling ? t('production.qualityPlans.editSamplingPoint') : t('production.qualityPlans.addSamplingPoint')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('production.qualityPlans.stage')}
              value={samplingForm.stage}
              onChange={(e) => setSamplingForm({ ...samplingForm, stage: e.target.value })}
              options={INSPECTION_STAGES.map((value) => ({ value, label: t(stageLabelKey(value)) }))}
            />
            <Input label={t('production.qualityPlans.sortOrder')} type="number" value={String(samplingForm.sortOrder)} onChange={(e) => setSamplingForm({ ...samplingForm, sortOrder: Number(e.target.value) || 0 })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup
              label={t('production.qualityPlans.measurementPoint')}
              adapter={productionMeasurementPointAdapter}
              value={samplingForm.measurementPointId}
              onChange={(value) => setSamplingForm({ ...samplingForm, measurementPointId: value })}
            />
            <F9Lookup
              label={t('production.qualityPlans.line')}
              adapter={productionLineAdapter}
              value={samplingForm.productionLineId}
              onChange={(value) => setSamplingForm({ ...samplingForm, productionLineId: value })}
            />
            <F9Lookup
              label={t('production.qualityPlans.machine')}
              adapter={machineAdapter}
              value={samplingForm.machineId}
              onChange={(value) => setSamplingForm({ ...samplingForm, machineId: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.qualityPlans.sampleFrequency')} value={samplingForm.sampleFrequency} onChange={(e) => setSamplingForm({ ...samplingForm, sampleFrequency: e.target.value })} />
            <Input label={t('production.qualityPlans.sampleSize')} type="number" step="0.0001" value={samplingForm.sampleSize} onChange={(e) => setSamplingForm({ ...samplingForm, sampleSize: e.target.value })} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={samplingForm.appliesToMaterial} onChange={(e) => setSamplingForm({ ...samplingForm, appliesToMaterial: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              {t('production.qualityPlans.appliesToMaterial')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={samplingForm.appliesToFinishedGoods} onChange={(e) => setSamplingForm({ ...samplingForm, appliesToFinishedGoods: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              {t('production.qualityPlans.appliesToFinishedGoods')}
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setSamplingModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={saveSampling} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
        title={confirmTitle()}
        message={confirmTitle()}
        variant={confirmAction?.kind === 'delete' || confirmAction?.kind === 'deactivate' ? 'danger' : undefined}
        loading={saving}
      >
        {(confirmAction?.kind === 'reject' || confirmAction?.kind === 'deactivate') && (
          <div className="mt-4">
            <Textarea
              label={confirmAction.kind === 'reject' ? t('production.qualityPlans.rejectReason') : t('production.qualityPlans.deactivateReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
