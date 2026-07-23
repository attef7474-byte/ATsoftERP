'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, machineCategoryAdapter, companyAdapter, branchAdapter, departmentAdapter, productionLineAdapter, operationTypeAdapter, costCenterAdapter, administrationAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { Machine } from '../../../../../../lib/admin-types';

export default function EditMachinePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<Machine | null>(null);
  const [form, setForm] = useState({ code: '', name: '', categoryId: '', companyId: '', branchId: '', departmentId: '', productionLineId: '', operationTypeId: '', defaultCostCenterId: '', technicalAdministrationId: '', technicalDepartmentId: '', model: '', serialNumber: '', manufacturer: '', location: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status === 'INACTIVE' || data?.status === 'SCRAPPED' || data?.status === 'OUT_OF_SERVICE';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/machines/${id}`);
      const item = res;
      setData(item);
      setForm({ code: item.code || '', name: item.name || '', categoryId: item.categoryId || '', companyId: item.companyId || '', branchId: item.branchId || '', departmentId: item.departmentId || '', productionLineId: item.productionLineId || '', operationTypeId: item.operationTypeId || '', defaultCostCenterId: item.defaultCostCenterId || '', technicalAdministrationId: item.technicalAdministrationId || '', technicalDepartmentId: item.technicalDepartmentId || '', model: item.model || '', serialNumber: item.serialNumber || '', manufacturer: item.manufacturer || '', location: item.location || '', notes: item.notes || '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    if (isReadOnly) return;
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'companyId') { setForm(prev => ({ ...prev, branchId: '', departmentId: '', productionLineId: '' })); }
    if (field === 'branchId') { setForm(prev => ({ ...prev, departmentId: '' })); }
    if (field === 'technicalAdministrationId') { setForm(prev => ({ ...prev, technicalDepartmentId: '' })); }
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = t('complexForms.requiredField');
    if (!form.name.trim()) errs.name = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.code.trim() !== data?.code) payload.code = form.code.trim();
      if (form.name.trim() !== data?.name) payload.name = form.name.trim();
      if (form.categoryId !== data?.categoryId) payload.categoryId = form.categoryId || null;
      if (form.companyId !== data?.companyId) payload.companyId = form.companyId || null;
      if (form.branchId !== data?.branchId) payload.branchId = form.branchId || null;
      if (form.departmentId !== data?.departmentId) payload.departmentId = form.departmentId || null;
      if (form.productionLineId !== data?.productionLineId) payload.productionLineId = form.productionLineId || null;
      if (form.operationTypeId !== data?.operationTypeId) payload.operationTypeId = form.operationTypeId || null;
      if (form.defaultCostCenterId !== data?.defaultCostCenterId) payload.defaultCostCenterId = form.defaultCostCenterId || null;
      if (form.technicalAdministrationId !== data?.technicalAdministrationId) payload.technicalAdministrationId = form.technicalAdministrationId || null;
      if (form.technicalDepartmentId !== data?.technicalDepartmentId) payload.technicalDepartmentId = form.technicalDepartmentId || null;
      if (form.model !== data?.model) payload.model = form.model.trim() || null;
      if (form.serialNumber !== data?.serialNumber) payload.serialNumber = form.serialNumber.trim() || null;
      if (form.manufacturer !== data?.manufacturer) payload.manufacturer = form.manufacturer.trim() || null;
      if (form.location !== data?.location) payload.location = form.location.trim() || null;
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/maintenance/machines/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/machines/${id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => fetchData(),
    save: () => handleSave(),
    saveAndView: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && !isReadOnly },
    { id: 'saveAndView', labelKey: 'complexForms.saveAndView', icon: <ActionViewIcon />, onClick: () => exec('saveAndView'), enabled: !saving && !isReadOnly },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {t('complexForms.readOnlyRecord')}
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editMachine')}</h1>
              <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required disabled={isReadOnly} />
              <Input label={t('maintenance.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required disabled={isReadOnly} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.classification')}</h2>
            <F9Lookup label={t('maintenance.machineCategory')} value={form.categoryId} onChange={(v) => setField('categoryId', v)} adapter={machineCategoryAdapter} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.organization')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
              <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setField('departmentId', v)} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.productionLine')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setField('productionLineId', v)} adapter={productionLineAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
              <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setField('operationTypeId', v)} adapter={operationTypeAdapter} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.technicalAdministration')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.technicalAdministration')} value={form.technicalAdministrationId} onChange={(v) => setField('technicalAdministrationId', v)} adapter={administrationAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
              <F9Lookup label={t('maintenance.technicalDepartment')} value={form.technicalDepartmentId} onChange={(v) => setField('technicalDepartmentId', v)} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}), ...(form.technicalAdministrationId ? { administrationId: form.technicalAdministrationId } : {}) }} />
            </div>
            <F9Lookup label={t('maintenance.defaultCostCenter')} value={form.defaultCostCenterId} onChange={(v) => setField('defaultCostCenterId', v)} adapter={costCenterAdapter} filters={{ ...(form.technicalAdministrationId ? { administrationId: form.technicalAdministrationId } : {}) }} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.technicalInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label={t('maintenance.model')} value={form.model} onChange={(e) => setField('model', e.target.value)} disabled={isReadOnly} />
              <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setField('serialNumber', e.target.value)} disabled={isReadOnly} />
              <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} disabled={isReadOnly} />
            </div>
            <Input label={t('maintenance.location')} value={form.location} onChange={(e) => setField('location', e.target.value)} disabled={isReadOnly} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={isReadOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('complexForms.metadata')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div><span className="font-medium">{t('common.createdAt')}:</span> {new Date(data.createdAt).toLocaleString()}</div>
            <div><span className="font-medium">{t('common.updatedAt')}:</span> {new Date(data.updatedAt).toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
