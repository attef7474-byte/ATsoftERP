'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { SparePart, Unit } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';
import { F9Lookup, productAdapter } from '../../../../components/f9';
import { MachineMultiSelect, MachineSelection } from '../../../../components/admin/maintenance/machine-multi-select';

export default function SparePartsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  // SparePart is a global canonical technical catalog. Writes are reserved for an
  // explicitly approved catalog-maintenance role, so a read-only operational user must
  // not be offered create/edit/delete/lifecycle controls.
  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`spare-part:${action}`)),
    [isSuperAdmin, permissions],
  );
  const canCreate = can('create');
  const canUpdate = can('update');
  const canDelete = can('delete');
  const canActivate = can('activate');
  const canDeactivate = can('deactivate');
  const canManageMachines = canUpdate;

  const [data, setData] = useState<SparePart[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [units, setUnits] = useState<Unit[]>([]);
  const [machineSelections, setMachineSelections] = useState<MachineSelection[]>([]);
  const [originalMachineIds, setOriginalMachineIds] = useState<Set<string>>(new Set());

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);
  const emptyForm = {
    code: '', name: '', description: '', category: '', specification: '',
    manufacturer: '', model: '', partNumber: '', barcode: '',
    minRecommendedStock: 0, maxRecommendedStock: 0, reorderPoint: 0, isCritical: false,
    technicalClassification: '', usageType: '', nature: '', importance: '',
    unitId: '', productId: '',
  };
  const [form, setForm] = useState(emptyForm);

  const unitLabel = useCallback((u: Unit) => {
    const name = locale === 'ar' ? u.nameAr : u.nameEn;
    return u.symbol ? `${name} (${u.symbol})` : `${u.code} — ${name}`;
  }, [locale]);

  const unitDisplay = useCallback((sp: SparePart) => {
    if (sp.unitRef) {
      const name = locale === 'ar' ? sp.unitRef.nameAr : sp.unitRef.nameEn;
      return sp.unitRef.symbol ? `${name} (${sp.unitRef.symbol})` : name;
    }
    return sp.unit || '-';
  }, [locale]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await api.get<{ data: SparePart[]; meta: typeof meta }>(`/maintenance/spare-parts?${params}`);
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get<{ data: Unit[] }>('/units', { params: { activeOnly: true, limit: 200 } });
      setUnits(res.data || []);
    } catch {
      setUnits([]);
    }
  }, []);

  const openNew = useCallback(() => {
    setEditingId(null);
    setValidationErrors({});
    setForm(emptyForm);
    setMachineSelections([]);
    setOriginalMachineIds(new Set());
    fetchUnits();
    setModalOpen(true);
  }, [fetchUnits]);

  const openEdit = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setEditingId(id);
    setValidationErrors({});
    setModalOpen(true);
    fetchUnits();
    try {
      const item = await api.get<SparePart>(`/maintenance/spare-parts/${id}`);
      setForm({
        code: item.code, name: item.name, description: item.description || '',
        category: item.category || '', specification: item.specification || '',
        manufacturer: item.manufacturer || '', model: item.model || '',
        partNumber: item.partNumber || '', barcode: item.barcode || '',
        minRecommendedStock: item.minRecommendedStock ?? 0,
        maxRecommendedStock: item.maxRecommendedStock ?? 0,
        reorderPoint: item.reorderPoint ?? 0, isCritical: item.isCritical,
        technicalClassification: item.technicalClassification || '',
        usageType: item.usageType || '', nature: item.nature || '', importance: item.importance || '',
        unitId: item.unitId || '', productId: item.productId || '',
      });
      const links = (item.machineLinks || [])
        .filter((l) => l.machine)
        .map((l) => ({ id: l.machine!.id, code: l.machine!.code, name: l.machine!.name }));
      setMachineSelections(links);
      setOriginalMachineIds(new Set(links.map((l) => l.id)));
    } catch (e: any) {
      handleApiError(e);
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  }, [fetchUnits, handleApiError]);

  const buildPayload = useCallback(() => ({
    name: form.name,
    description: form.description || undefined,
    category: form.category || undefined,
    specification: form.specification || undefined,
    manufacturer: form.manufacturer || undefined,
    model: form.model || undefined,
    partNumber: form.partNumber || undefined,
    barcode: form.barcode || undefined,
    minRecommendedStock: form.minRecommendedStock,
    maxRecommendedStock: form.maxRecommendedStock,
    reorderPoint: form.reorderPoint,
    isCritical: form.isCritical,
    technicalClassification: form.technicalClassification || undefined,
    usageType: form.usageType || undefined,
    nature: form.nature || undefined,
    importance: form.importance || undefined,
    unitId: form.unitId || null,
    productId: form.productId || null,
  }), [form]);

  const syncMachineLinks = useCallback(async (sparePartId: string) => {
    if (!canManageMachines) return;
    const nextIds = machineSelections.map((m) => m.id);
    const changed = nextIds.length !== originalMachineIds.size
      || nextIds.some((id) => !originalMachineIds.has(id));
    if (!changed) return;
    await api.put(`/maintenance/spare-parts/${sparePartId}/machines`, { machineIds: nextIds });
  }, [canManageMachines, machineSelections, originalMachineIds]);

  const handleSave = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!form.name) errs.name = t('validation.required');
    if (Object.keys(errs).length > 0) { setValidationErrors(errs); return; }
    setValidationErrors({});
    setSaving(true);
    try {
      const payload = buildPayload();
      let sparePartId = editingId;
      if (editingId) {
        const { code, ...rest } = payload as any;
        await api.patch(`/maintenance/spare-parts/${editingId}`, rest);
      } else {
        const created = await api.post<SparePart>('/maintenance/spare-parts', payload);
        sparePartId = created.id;
      }
      if (sparePartId) await syncMachineLinks(sparePartId);
      showToast(editingId ? t('maintenance.sparePartUpdated') : t('maintenance.sparePartCreated'), 'success');
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData, buildPayload, syncMachineLinks, handleApiError]);

  const handleStatusChange = useCallback(async (id: string, action: 'activate' | 'deactivate') => {
    setConfirmAction(null);
    try {
      await api.patch(`/maintenance/spare-parts/${id}/${action}`, {});
      showToast(action === 'activate' ? t('common.activated') : t('common.deactivated'), 'success');
      fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
  }, [meta.page, showToast, t, fetchData, handleApiError]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/spare-parts/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [selectedId, showToast, t, fetchData, handleApiError]);

  const { exec } = useStableHandlers({
    add: () => openNew(),
    refresh: () => fetchData(meta.page),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'add', labelKey: 'actions.add', icon: <ActionAddIcon />, permission: 'spare-part:create', onClick: () => exec('add'), enabled: canCreate },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', permission: 'spare-part:delete', onClick: () => exec('delete'), enabled: !!selectedId && canDelete },
  ]);

  const columns: GridColumn<SparePart>[] = [
    { key: 'code', header: t('maintenance.sparePartCode'), sortable: true },
    { key: 'name', header: t('maintenance.sparePartName'), sortable: true },
    { key: 'category', header: t('maintenance.partCategory') },
    { key: 'manufacturer', header: t('maintenance.manufacturer') },
    { key: 'model', header: t('maintenance.sparePart.form.model') },
    { key: 'partNumber', header: t('maintenance.partNumber') },
    { key: 'unit', header: t('maintenance.sparePart.form.unit'), render: (s) => unitDisplay(s) },
    { key: 'product', header: t('maintenance.sparePart.form.linkedProduct'), render: (s) => s.product ? `[${s.product.code}] ${s.product.name}` : '-' },
    { key: 'linkedMachines', header: t('maintenance.sparePart.form.linkedMachines'), align: 'center', render: (s) => String(s._count?.machineLinks ?? s.linkedMachineCount ?? 0) },
    { key: 'importance', header: t('maintenance.sparePart.form.importance') },
    { key: 'isCritical', header: t('maintenance.criticalPart'), render: (s) => s.isCritical ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), render: (s) => s.status },
  ];

  const gridActions: GridAction<SparePart>[] = [
    { label: t('actions.view'), onClick: (s) => router.push(`/admin/maintenance/spare-parts/${s.id}`) },
    { label: t('actions.edit'), permission: 'spare-part:update', onClick: (s) => openEdit(s.id), enabled: () => canUpdate },
    { label: t('common.delete'), permission: 'spare-part:delete', onClick: (s) => { setSelectedId(s.id); setConfirmDeleteOpen(true); }, variant: 'danger', enabled: () => canDelete },
    { label: t('actions.deactivate'), permission: 'spare-part:deactivate', onClick: (s) => setConfirmAction({ id: s.id, action: 'deactivate' }), enabled: (s) => s.status === 'ACTIVE' && canDeactivate },
    { label: t('actions.activate'), permission: 'spare-part:activate', onClick: (s) => setConfirmAction({ id: s.id, action: 'activate' }), enabled: (s) => s.status !== 'ACTIVE' && canActivate },
  ];

  const unitOptions = units.map((u) => ({ value: u.id, label: unitLabel(u) }));

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.sparePartsUnifiedTitle')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<SparePart>
        columns={columns}
        data={data}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => setSelectedId(s.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('maintenance.noSpareParts')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-5">
          {/* Section A — Spare Part Data */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1">{t('maintenance.sparePart.section.data')}</h3>
            {editingId ? (
              <Input label={t('maintenance.sparePart.form.code')} value={form.code} disabled />
            ) : (
              <div className="text-sm text-gray-500">{t('maintenance.sparePart.form.code')}: {t('common.autoGenerated')}</div>
            )}
            <div>
              <Input label={`${t('maintenance.sparePart.form.name')} *`} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (validationErrors.name) setValidationErrors((prev) => { const n = { ...prev }; delete n.name; return n; }); }} />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
            <Input label={t('maintenance.sparePart.form.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="rounded" />
              {t('maintenance.sparePart.form.isCritical')}
            </label>
          </section>

          {/* Section B — Technical Data (Description + Specification unified into one field) */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1">{t('maintenance.sparePart.section.technical')}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('maintenance.sparePart.form.technicalDescription')}</label>
              <Textarea value={form.specification} rows={2} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
            </div>
            <Input label={t('maintenance.sparePart.form.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.partNumber')} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <Select label={t('maintenance.sparePart.form.technicalClassification')} value={form.technicalClassification} onChange={(e) => setForm({ ...form, technicalClassification: e.target.value })} options={[
              { value: '', label: '' }, { value: 'MECHANICAL', label: t('maintenance.sparePart.classification.mechanical') },
              { value: 'ELECTRICAL', label: t('maintenance.sparePart.classification.electrical') },
              { value: 'ELECTRONIC', label: t('maintenance.sparePart.classification.electronic') },
              { value: 'HYDRAULIC', label: t('maintenance.sparePart.classification.hydraulic') },
              { value: 'PNEUMATIC', label: t('maintenance.sparePart.classification.pneumatic') },
              { value: 'LUBRICANT', label: t('maintenance.sparePart.classification.lubricant') },
              { value: 'CHEMICAL', label: t('maintenance.sparePart.classification.chemical') },
              { value: 'SAFETY', label: t('maintenance.sparePart.classification.safety') },
              { value: 'GENERAL', label: t('maintenance.sparePart.classification.general') },
            ]} />
            <Select label={t('maintenance.sparePart.form.usageType')} value={form.usageType} onChange={(e) => setForm({ ...form, usageType: e.target.value })} options={[
              { value: '', label: '' }, { value: 'CONSUMABLE', label: t('maintenance.sparePart.usageType.consumable') },
              { value: 'REPLACEABLE', label: t('maintenance.sparePart.usageType.replaceable') },
              { value: 'REPAIRABLE', label: t('maintenance.sparePart.usageType.repairable') },
              { value: 'ROTABLE', label: t('maintenance.sparePart.usageType.rotable') },
            ]} />
            <Select label={t('maintenance.sparePart.form.nature')} value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} options={[
              { value: '', label: '' }, { value: 'ORIGINAL', label: t('maintenance.sparePart.nature.original') },
              { value: 'GENERIC', label: t('maintenance.sparePart.nature.generic') },
              { value: 'REFURBISHED', label: t('maintenance.sparePart.nature.refurbished') },
              { value: 'LOCAL', label: t('maintenance.sparePart.nature.local') },
            ]} />
            <Select label={t('maintenance.sparePart.form.importance')} value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })} options={[
              { value: '', label: '' }, { value: 'CRITICAL', label: t('maintenance.sparePart.importance.critical') },
              { value: 'HIGH', label: t('maintenance.sparePart.importance.high') },
              { value: 'MEDIUM', label: t('maintenance.sparePart.importance.medium') },
              { value: 'LOW', label: t('maintenance.sparePart.importance.low') },
            ]} />
          </section>

          {/* Section C — Inventory Link */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1">{t('maintenance.sparePart.section.inventoryLink')}</h3>
            <F9Lookup
              label={t('maintenance.sparePart.form.linkedProduct')}
              value={form.productId}
              onChange={(value) => setForm((f) => ({ ...f, productId: value }))}
              adapter={productAdapter}
              placeholder={t('f9.pressToSearch')}
            />
            <Select
              label={t('maintenance.sparePart.form.unit')}
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={unitOptions}
              placeholder={t('maintenance.sparePart.form.noUnit')}
              description={t('maintenance.sparePart.form.unitHint')}
            />
            <Input label={t('maintenance.sparePart.form.minRecommendedStock')} type="number" value={form.minRecommendedStock} onChange={(e) => setForm({ ...form, minRecommendedStock: Number(e.target.value) })} />
            <Input label={t('maintenance.sparePart.form.maxRecommendedStock')} type="number" value={form.maxRecommendedStock} onChange={(e) => setForm({ ...form, maxRecommendedStock: Number(e.target.value) })} />
            <Input label={t('maintenance.sparePart.form.reorderPoint')} type="number" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: Number(e.target.value) })} />
          </section>

          {/* Section D — Linked Machines */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1">{t('maintenance.sparePart.section.machines')}</h3>
            <MachineMultiSelect
              label={t('maintenance.sparePart.form.linkedMachines')}
              value={machineSelections}
              onChange={setMachineSelections}
              disabled={!canManageMachines}
              description={t('maintenance.sparePart.form.machinesHint')}
            />
          </section>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !(canCreate || canUpdate)} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmAction?.action === 'deactivate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'deactivate')} title={t('common.deactivate')} message={t('maintenance.confirmDeactivateSparePart')} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'activate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'activate')} title={t('common.activate')} message={t('maintenance.confirmActivateSparePart')} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('maintenance.confirmDeleteSparePart')} variant="danger" />
    </div>
  );
}
