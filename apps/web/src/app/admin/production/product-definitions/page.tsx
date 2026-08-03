'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionProductDefinition, ProductionSpecification, ProductionVersion, ProductionPackaging, ProductionEligibility } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, productAdapter, productionUnitAdapter, productionLineAdapter, warehouseAdapter, costCenterAdapter, machineAdapter } from '../../../../components/f9';

type ChildTab = 'specifications' | 'versions' | 'packagings' | 'eligibilities';

export default function ProductionProductDefinitionsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionProductDefinition[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionProductDefinition | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', description: '', productId: '',
    defaultUnitId: '', defaultLineId: '', defaultWarehouseId: '', defaultCostCenterId: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const [detail, setDetail] = useState<ProductionProductDefinition | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetailChildren, setLoadingDetailChildren] = useState(false);
  const [childTab, setChildTab] = useState<ChildTab>('specifications');
  const [childFormOpen, setChildFormOpen] = useState(false);
  const [childEditItem, setChildEditItem] = useState<any>(null);
  const [childForm, setChildForm] = useState<any>({});
  const [childSaving, setChildSaving] = useState(false);
  const [childErrors, setChildErrors] = useState<Record<string, string>>({});

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
    view: () => selectedId && openDetail(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'view', labelKey: 'common.view', icon: <ActionViewIcon />, onClick: () => exec('view'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: ProductionProductDefinition[]; meta: any }>('/production/product-definitions', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', productId: '', defaultUnitId: '', defaultLineId: '', defaultWarehouseId: '', defaultCostCenterId: '' });
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, name: item.name, description: item.description || '', productId: item.productId,
        defaultUnitId: item.defaultUnitId || '', defaultLineId: item.defaultLineId || '',
        defaultWarehouseId: item.defaultWarehouseId || '', defaultCostCenterId: item.defaultCostCenterId || '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.productId) errors.productId = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name || undefined,
        description: form.description || undefined,
        productId: form.productId,
        defaultUnitId: form.defaultUnitId || undefined,
        defaultLineId: form.defaultLineId || undefined,
        defaultWarehouseId: form.defaultWarehouseId || undefined,
        defaultCostCenterId: form.defaultCostCenterId || undefined,
      };
      if (editItem) {
        await api.patch(`/production/product-definitions/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/product-definitions', { ...payload, code: form.code || undefined });
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmStatusOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/production/product-definitions/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/product-definitions/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setLoadingDetailChildren(true);
    try {
      const item = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setDetail(item);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setDetailOpen(false);
    }
    finally { setLoadingDetailChildren(false); }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    setLoadingDetailChildren(true);
    try {
      setDetail(await api.get<ProductionProductDefinition>(`/production/product-definitions/${detail.id}`));
    } catch (err: any) { handleApiError(err); }
    finally { setLoadingDetailChildren(false); }
  };

  const openChildForm = (child?: any) => {
    setChildEditItem(child || null);
    setChildErrors({});
    if (childTab === 'specifications') {
      setChildForm(child ? { attributeName: child.attributeName, attributeValue: child.attributeValue, dataType: child.dataType, unitId: child.unitId || '', isRequired: child.isRequired, sortOrder: String(child.sortOrder) } : { attributeName: '', attributeValue: '', dataType: 'TEXT', unitId: '', isRequired: false, sortOrder: '0' });
    } else if (childTab === 'versions') {
      setChildForm(child ? { versionNumber: child.versionNumber, versionLabel: child.versionLabel, description: child.description || '', isCurrent: child.isCurrent } : { versionNumber: '', versionLabel: '', description: '', isCurrent: false });
    } else if (childTab === 'packagings') {
      setChildForm(child ? { packagingType: child.packagingType, packQuantity: child.packQuantity, unitId: child.unitId || '', grossWeight: child.grossWeight ?? '', netWeight: child.netWeight ?? '', isDefault: child.isDefault } : { packagingType: 'BAG', packQuantity: '', unitId: '', grossWeight: '', netWeight: '', isDefault: false });
    } else {
      setChildForm(child ? { resourceType: child.resourceType, machineId: child.machineId || '', productionLineId: child.productionLineId || '', priority: String(child.priority), isDefault: child.isDefault, notes: child.notes || '' } : { resourceType: 'MACHINE', machineId: '', productionLineId: '', priority: '0', isDefault: false, notes: '' });
    }
    setChildFormOpen(true);
  };

  const handleChildSave = async () => {
    if (!detail) return;
    const errors: Record<string, string> = {};
    if (childTab === 'specifications' && !childForm.attributeName) errors.attributeName = t('validation.required');
    if (childTab === 'versions' && !childForm.versionLabel) errors.versionLabel = t('validation.required');
    if (childTab === 'packagings' && (!childForm.packagingType || !childForm.packQuantity)) errors.packagingType = t('validation.required');
    if (childTab === 'eligibilities' && !childForm.resourceType) errors.resourceType = t('validation.required');
    setChildErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setChildSaving(true);
    try {
      const base = `/production/product-definitions/${detail.id}`;
      let payload: any;
      if (childTab === 'specifications') {
        payload = { attributeName: childForm.attributeName, attributeValue: childForm.attributeValue, dataType: childForm.dataType, unitId: childForm.unitId || undefined, isRequired: childForm.isRequired, sortOrder: Number(childForm.sortOrder) || 0 };
      } else if (childTab === 'versions') {
        payload = { versionNumber: childForm.versionNumber ? Number(childForm.versionNumber) : undefined, versionLabel: childForm.versionLabel, description: childForm.description || undefined, isCurrent: childForm.isCurrent };
      } else if (childTab === 'packagings') {
        payload = { packagingType: childForm.packagingType, packQuantity: Number(childForm.packQuantity), unitId: childForm.unitId || undefined, grossWeight: childForm.grossWeight === '' ? undefined : Number(childForm.grossWeight), netWeight: childForm.netWeight === '' ? undefined : Number(childForm.netWeight), isDefault: childForm.isDefault };
      } else {
        payload = { resourceType: childForm.resourceType, machineId: childForm.resourceType === 'MACHINE' ? childForm.machineId : undefined, productionLineId: childForm.resourceType === 'LINE' ? childForm.productionLineId : undefined, priority: Number(childForm.priority) || 0, isDefault: childForm.isDefault, notes: childForm.notes || undefined };
      }
      if (childEditItem) {
        await api.patch(`${base}/${childTab}/${childEditItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post(`${base}/${childTab}`, payload);
        showToast(t('common.successCreated'), 'success');
      }
      setChildFormOpen(false);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setChildSaving(false); }
  };

  const handleChildAction = async (childId: string, action: string) => {
    if (!detail) return;
    setChildSaving(true);
    try {
      const base = `/production/product-definitions/${detail.id}`;
      if (action === 'delete') {
        await api.delete(`${base}/${childTab}/${childId}`);
        showToast(t('common.successDeleted'), 'success');
      } else if (action === 'set-current') {
        await api.patch(`${base}/versions/${childId}/set-current`);
        showToast(t('common.successUpdated'), 'success');
      } else if (action === 'set-default') {
        await api.patch(`${base}/packagings/${childId}/set-default`);
        showToast(t('common.successUpdated'), 'success');
      }
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setChildSaving(false); }
  };

  const columns: GridColumn<ProductionProductDefinition>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'product', header: t('production.product'), render: (p: ProductionProductDefinition) => p.product ? `[${p.product.code}] ${p.product.name}` : '-' },
    { key: 'defaultUnit', header: t('production.defaultUnit'), render: (p: ProductionProductDefinition) => p.defaultUnit?.name || '-' },
    { key: 'defaultLine', header: t('production.defaultLine'), render: (p: ProductionProductDefinition) => p.defaultLine?.name || '-' },
    { key: 'defaultWarehouse', header: t('production.defaultWarehouse'), render: (p: ProductionProductDefinition) => p.defaultWarehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (p: ProductionProductDefinition) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<ProductionProductDefinition>[] = [
    { label: t('common.view'), onClick: (p: ProductionProductDefinition) => openDetail(p.id) },
    { label: t('actions.edit'), onClick: (p: ProductionProductDefinition) => openEdit(p.id) },
    { label: t('common.delete'), onClick: (p: ProductionProductDefinition) => { setSelectedId(p.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (p: ProductionProductDefinition) => confirmStatus(p.id), enabled: (p: ProductionProductDefinition) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: ProductionProductDefinition) => confirmStatus(p.id), enabled: (p: ProductionProductDefinition) => p.status !== 'ACTIVE' },
  ];

  const childTabs: { id: ChildTab; label: string }[] = [
    { id: 'specifications', label: t('production.specifications') },
    { id: 'versions', label: t('production.versions') },
    { id: 'packagings', label: t('production.packagings') },
    { id: 'eligibilities', label: t('production.eligibilities') },
  ];

  const renderChildren = () => {
    if (!detail) return null;
    if (childTab === 'specifications') {
      const items = detail.specifications || [];
      return (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => openChildForm()}>{t('production.addSpecification')}</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">{t('production.attributeName')}</th>
                <th className="py-2">{t('production.attributeValue')}</th>
                <th className="py-2">{t('production.dataType')}</th>
                <th className="py-2">{t('production.isRequired')}</th>
                <th className="py-2">{t('production.sortOrder')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-500">{t('common.noData')}</td></tr>}
              {items.map((s: ProductionSpecification) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2">{s.attributeName}</td>
                  <td className="py-2">{s.attributeValue}</td>
                  <td className="py-2">{s.dataType}</td>
                  <td className="py-2">{s.isRequired ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2">{s.sortOrder}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="secondary" onClick={() => openChildForm(s)}>{t('actions.edit')}</Button>
                    <Button size="sm" variant="danger" className="ml-2" onClick={() => handleChildAction(s.id, 'delete')}>{t('common.delete')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (childTab === 'versions') {
      const items = detail.versions || [];
      return (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => openChildForm()}>{t('production.addVersion')}</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">{t('production.versionNumber')}</th>
                <th className="py-2">{t('production.versionLabel')}</th>
                <th className="py-2">{t('production.isCurrent')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-500">{t('common.noData')}</td></tr>}
              {items.map((v: ProductionVersion) => (
                <tr key={v.id} className="border-b">
                  <td className="py-2">{v.versionNumber}</td>
                  <td className="py-2">{v.versionLabel}</td>
                  <td className="py-2">{v.isCurrent ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2 text-right">
                    {!v.isCurrent && <Button size="sm" variant="secondary" onClick={() => handleChildAction(v.id, 'set-current')}>{t('production.setCurrent')}</Button>}
                    <Button size="sm" variant="secondary" className="ml-2" onClick={() => openChildForm(v)}>{t('actions.edit')}</Button>
                    <Button size="sm" variant="danger" className="ml-2" onClick={() => handleChildAction(v.id, 'delete')}>{t('common.delete')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (childTab === 'packagings') {
      const items = detail.packagings || [];
      return (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => openChildForm()}>{t('production.addPackaging')}</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">{t('production.packagingType')}</th>
                <th className="py-2">{t('production.packQuantity')}</th>
                <th className="py-2">{t('production.grossWeight')}</th>
                <th className="py-2">{t('production.netWeight')}</th>
                <th className="py-2">{t('production.isDefault')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-500">{t('common.noData')}</td></tr>}
              {items.map((p: ProductionPackaging) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.packagingType}</td>
                  <td className="py-2">{p.packQuantity}</td>
                  <td className="py-2">{p.grossWeight ?? '-'}</td>
                  <td className="py-2">{p.netWeight ?? '-'}</td>
                  <td className="py-2">{p.isDefault ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2 text-right">
                    {!p.isDefault && <Button size="sm" variant="secondary" onClick={() => handleChildAction(p.id, 'set-default')}>{t('production.setDefault')}</Button>}
                    <Button size="sm" variant="secondary" className="ml-2" onClick={() => openChildForm(p)}>{t('actions.edit')}</Button>
                    <Button size="sm" variant="danger" className="ml-2" onClick={() => handleChildAction(p.id, 'delete')}>{t('common.delete')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const items = detail.eligibilities || [];
    return (
      <div>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => openChildForm()}>{t('production.addEligibility')}</Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">{t('production.resourceType')}</th>
              <th className="py-2">{t('production.resourceMachine')}</th>
              <th className="py-2">{t('production.resourceLine')}</th>
              <th className="py-2">{t('production.priority')}</th>
              <th className="py-2">{t('production.isDefault')}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-500">{t('common.noData')}</td></tr>}
            {items.map((e: ProductionEligibility) => (
              <tr key={e.id} className="border-b">
                <td className="py-2">{e.resourceType}</td>
                <td className="py-2">{e.machine?.name || '-'}</td>
                <td className="py-2">{e.productionLine?.name || '-'}</td>
                <td className="py-2">{e.priority}</td>
                <td className="py-2">{e.isDefault ? t('common.yes') : t('common.no')}</td>
                <td className="py-2 text-right">
                  <Button size="sm" variant="secondary" onClick={() => openChildForm(e)}>{t('actions.edit')}</Button>
                  <Button size="sm" variant="danger" className="ml-2" onClick={() => handleChildAction(e.id, 'delete')}>{t('common.delete')}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChildForm = () => {
    if (!detail) return null;
    if (childTab === 'specifications') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.attributeName')} value={childForm.attributeName} onChange={(e) => { setChildForm({ ...childForm, attributeName: e.target.value }); setChildErrors(p => ({ ...p, attributeName: '' })); }} required />
              {childErrors.attributeName && <p className="text-red-500 text-sm mt-1">{childErrors.attributeName}</p>}
            </div>
            <Input label={t('production.attributeValue')} value={childForm.attributeValue} onChange={(e) => setChildForm({ ...childForm, attributeValue: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('production.dataType')} value={childForm.dataType} options={['TEXT', 'NUMBER', 'BOOLEAN', 'DATE'].map(v => ({ value: v, label: v }))} onChange={(e) => setChildForm({ ...childForm, dataType: e.target.value })} />
            <F9Lookup label={t('production.defaultUnit')} value={childForm.unitId} onChange={(v) => setChildForm({ ...childForm, unitId: v })} adapter={productionUnitAdapter} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.sortOrder')} value={childForm.sortOrder} onChange={(e) => setChildForm({ ...childForm, sortOrder: e.target.value })} />
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={!!childForm.isRequired} onChange={(e) => setChildForm({ ...childForm, isRequired: e.target.checked })} />
              <span className="text-sm">{t('production.isRequired')}</span>
            </label>
          </div>
        </div>
      );
    }
    if (childTab === 'versions') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.versionNumber')} value={childForm.versionNumber} onChange={(e) => setChildForm({ ...childForm, versionNumber: e.target.value })} />
            <div>
              <Input label={t('production.versionLabel')} value={childForm.versionLabel} onChange={(e) => { setChildForm({ ...childForm, versionLabel: e.target.value }); setChildErrors(p => ({ ...p, versionLabel: '' })); }} required />
              {childErrors.versionLabel && <p className="text-red-500 text-sm mt-1">{childErrors.versionLabel}</p>}
            </div>
          </div>
          <Textarea label={t('production.versionDescription')} value={childForm.description} onChange={(e) => setChildForm({ ...childForm, description: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!childForm.isCurrent} onChange={(e) => setChildForm({ ...childForm, isCurrent: e.target.checked })} />
            <span className="text-sm">{t('production.isCurrent')}</span>
          </label>
        </div>
      );
    }
    if (childTab === 'packagings') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label={t('production.packagingType')} value={childForm.packagingType} options={['BAG', 'BOX', 'CARTON', 'PALLET', 'DRUM', 'TANK', 'OTHER'].map(v => ({ value: v, label: v }))} onChange={(e) => setChildForm({ ...childForm, packagingType: e.target.value })} />
              {childErrors.packagingType && <p className="text-red-500 text-sm mt-1">{childErrors.packagingType}</p>}
            </div>
            <Input label={t('production.packQuantity')} value={childForm.packQuantity} onChange={(e) => setChildForm({ ...childForm, packQuantity: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.defaultUnit')} value={childForm.unitId} onChange={(v) => setChildForm({ ...childForm, unitId: v })} adapter={productionUnitAdapter} />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('production.grossWeight')} value={childForm.grossWeight} onChange={(e) => setChildForm({ ...childForm, grossWeight: e.target.value })} />
              <Input label={t('production.netWeight')} value={childForm.netWeight} onChange={(e) => setChildForm({ ...childForm, netWeight: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!childForm.isDefault} onChange={(e) => setChildForm({ ...childForm, isDefault: e.target.checked })} />
            <span className="text-sm">{t('production.isDefault')}</span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Select label={t('production.resourceType')} value={childForm.resourceType} options={[{ value: 'MACHINE', label: t('production.resourceMachine') }, { value: 'LINE', label: t('production.resourceLine') }]} onChange={(e) => setChildForm({ ...childForm, resourceType: e.target.value, machineId: '', productionLineId: '' })} />
        {childForm.resourceType === 'MACHINE' ? (
          <F9Lookup label={t('production.machine')} value={childForm.machineId} onChange={(v) => setChildForm({ ...childForm, machineId: v })} adapter={machineAdapter} />
        ) : (
          <F9Lookup label={t('production.line')} value={childForm.productionLineId} onChange={(v) => setChildForm({ ...childForm, productionLineId: v })} adapter={productionLineAdapter} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('production.priority')} value={childForm.priority} onChange={(e) => setChildForm({ ...childForm, priority: e.target.value })} />
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={!!childForm.isDefault} onChange={(e) => setChildForm({ ...childForm, isDefault: e.target.checked })} />
            <span className="text-sm">{t('production.isDefault')}</span>
          </label>
        </div>
        <Textarea label={t('production.eligibilityNotes')} value={childForm.notes} onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })} />
      </div>
    );
  };

  return (
    <div>
      <PageHeader title={t('production.productDefinitions')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: ProductionProductDefinition) => p.id}
        onRowClick={(p: ProductionProductDefinition) => setSelectedId(p.id)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editDefinition') : t('production.newDefinition')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeImmutableHint')}</p>
              </div>
            ) : (
              <div>
                <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeHint')}</p>
              </div>
            )}
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <F9Lookup label={t('production.product')} value={form.productId} onChange={(v) => { setForm({ ...form, productId: v }); setValidationErrors(prev => ({ ...prev, productId: '' })); }} adapter={productAdapter} />
            {validationErrors.productId && <p className="text-red-500 text-sm mt-1">{validationErrors.productId}</p>}
          </div>
          <Textarea label={t('production.definitionDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.defaultUnit')} value={form.defaultUnitId} onChange={(v) => setForm({ ...form, defaultUnitId: v })} adapter={productionUnitAdapter} />
            <F9Lookup label={t('production.defaultLine')} value={form.defaultLineId} onChange={(v) => setForm({ ...form, defaultLineId: v })} adapter={productionLineAdapter} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.defaultWarehouse')} value={form.defaultWarehouseId} onChange={(v) => setForm({ ...form, defaultWarehouseId: v })} adapter={warehouseAdapter} />
            <F9Lookup label={t('production.defaultCostCenter')} value={form.defaultCostCenterId} onChange={(v) => setForm({ ...form, defaultCostCenterId: v })} adapter={costCenterAdapter} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? `[${detail.code}] ${detail.name}` : ''} size="lg">
        {loadingDetailChildren ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {childTabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-3 py-1.5 text-sm rounded-md border ${childTab === tab.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setChildTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {renderChildren()}
        </div>
        )}
      </Modal>

      <Modal open={childFormOpen} onClose={() => setChildFormOpen(false)} title={childEditItem ? t('common.edit') : t('common.create')} size="md">
        <div className="space-y-4">
          {renderChildForm()}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setChildFormOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleChildSave} loading={childSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmStatusOpen} onClose={() => setConfirmStatusOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
