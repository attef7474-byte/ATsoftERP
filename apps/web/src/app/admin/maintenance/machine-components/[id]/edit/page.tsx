'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Input, Card, CardContent, Select, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { F9Lookup, F9MultiLookup, machineComponentAdapter, machineAdapter, type MultiLookupItem } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionSaveIcon, ActionCancelIcon, ActionBackIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MachineComponent } from '../../../../../../lib/admin-types';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../../lib/form-validation';

const COMPONENT_TYPE_KEYS: { value: string; labelKey: string }[] = [
  { value: 'MECHANICAL', labelKey: 'maintenance.componentTypeOptions.MECHANICAL' },
  { value: 'ELECTRICAL', labelKey: 'maintenance.componentTypeOptions.ELECTRICAL' },
  { value: 'CONTROL', labelKey: 'maintenance.componentTypeOptions.CONTROL' },
  { value: 'PNEUMATIC', labelKey: 'maintenance.componentTypeOptions.PNEUMATIC' },
  { value: 'HYDRAULIC', labelKey: 'maintenance.componentTypeOptions.HYDRAULIC' },
  { value: 'HEATING', labelKey: 'maintenance.componentTypeOptions.HEATING' },
  { value: 'COOLING', labelKey: 'maintenance.componentTypeOptions.COOLING' },
  { value: 'SENSOR', labelKey: 'maintenance.componentTypeOptions.SENSOR' },
  { value: 'SAFETY', labelKey: 'maintenance.componentTypeOptions.SAFETY' },
  { value: 'CONVEYOR', labelKey: 'maintenance.componentTypeOptions.CONVEYOR' },
  { value: 'FRAME', labelKey: 'maintenance.componentTypeOptions.FRAME' },
  { value: 'UTILITY', labelKey: 'maintenance.componentTypeOptions.UTILITY' },
  { value: 'OTHER', labelKey: 'maintenance.componentTypeOptions.OTHER' },
];

const CRITICALITY_KEYS: { value: string; labelKey: string }[] = [
  { value: 'LOW', labelKey: 'maintenance.criticalityOptions.LOW' },
  { value: 'MEDIUM', labelKey: 'maintenance.criticalityOptions.MEDIUM' },
  { value: 'HIGH', labelKey: 'maintenance.criticalityOptions.HIGH' },
  { value: 'CRITICAL', labelKey: 'maintenance.criticalityOptions.CRITICAL' },
];

type MachineDatum = { locationInMachine: string; serialNumber: string };

export default function EditMachineComponentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const id = params?.id as string;
  const [data, setData] = useState<MachineComponent | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', componentType: '', criticality: '', manufacturer: '', model: '', parentComponentId: '', machineIds: [] as string[], machineData: {} as Record<string, MachineDatum> });
  const [machineItems, setMachineItems] = useState<MultiLookupItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status !== 'ACTIVE';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const item = await api.get<MachineComponent>(`/maintenance/machine-components/${id}`);
      const machines = item.machines ?? item.machineLinks ?? [];
      const machineIds = machines.filter((m) => m.status === 'ACTIVE').map((m) => m.machineId);
      const machineData: Record<string, MachineDatum> = {};
      for (const machine of machines) {
        machineData[machine.machineId] = {
          locationInMachine: machine.locationInMachine ?? '',
          serialNumber: machine.serialNumber ?? '',
        };
      }
      setData(item);
      setForm({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        componentType: item.componentType || '',
        criticality: item.criticality || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        parentComponentId: item.parentComponentId || '',
        machineIds,
        machineData,
      });
      setMachineItems(machineIds.map((machineId) => {
        const machine: any = machines.find((m) => m.machineId === machineId);
        return { id: machineId, label: machine?.name || machine?.code || machine?.machine?.name || machine?.machine?.code || machineId };
      }));
    } catch (err: any) {
      const config = handleApiError(err);
      setError(config.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    if (isReadOnly) return;
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleMachinesChange = (ids: string[]) => {
    if (isReadOnly) return;
    setForm((prev) => {
      const machineData: Record<string, MachineDatum> = {};
      for (const machineId of ids) machineData[machineId] = prev.machineData[machineId] ?? { locationInMachine: '', serialNumber: '' };
      return { ...prev, machineIds: ids, machineData };
    });
    setDirty(true);
    setErrors((prev) => ({ ...prev, machineIds: '' }));
  };

  const handleMachineItemsChange = useCallback((items: MultiLookupItem[]) => setMachineItems(items), []);

  const handleMachineDataChange = (machineId: string, field: keyof MachineDatum, value: string) => {
    if (isReadOnly) return;
    setForm((prev) => ({
      ...prev,
      machineData: {
        ...prev.machineData,
        [machineId]: { ...(prev.machineData[machineId] ?? { locationInMachine: '', serialNumber: '' }), [field]: value },
      },
    }));
    setDirty(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('validation.required');
    if (!form.componentType) errs.componentType = t('validation.required');
    if (form.machineIds.length === 0) errs.machineIds = t('validation.required');
    setErrors(errs);
    focusFirstInvalidField(Object.entries(errs).map(([field, message]) => ({ field, code: 'validation.required', message })));
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (saving || isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const machineData = form.machineIds.map((machineId) => ({
        machineId,
        ...(form.machineData[machineId] ?? { locationInMachine: '', serialNumber: '' }),
      }));
      const payload: Record<string, any> = { machineIds: form.machineIds, machineData };
      if (form.name.trim() !== data?.name) payload.name = form.name.trim();
      if (form.description !== data?.description) payload.description = form.description.trim() || null;
      if (form.componentType !== data?.componentType) payload.componentType = form.componentType;
      if (form.criticality !== data?.criticality) payload.criticality = form.criticality;
      if (form.manufacturer !== data?.manufacturer) payload.manufacturer = form.manufacturer.trim() || null;
      if (form.model !== data?.model) payload.model = form.model.trim() || null;
      if (form.parentComponentId !== data?.parentComponentId) payload.parentComponentId = form.parentComponentId || null;
      await api.patch(`/maintenance/machine-components/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/machine-components/${id}`);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, permission: 'machine-component:update', onClick: () => exec('save'), enabled: !saving && !isReadOnly },
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
              <h1 className="text-lg font-semibold text-gray-900">{t('maintenance.editMachineComponent')}</h1>
              <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.components.form.code')} value={form.code} disabled />
              <p className="text-sm text-gray-500 self-end pb-2">{t('common.codeImmutableHint')}</p>
              <Input label={t('maintenance.components.form.name')} name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required disabled={isReadOnly} />
              <div>
                <Select label={t('maintenance.components.form.componentType')} value={form.componentType} onChange={(e) => setField('componentType', e.target.value)} options={COMPONENT_TYPE_KEYS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.select')} error={errors.componentType} required disabled={isReadOnly} />
                {errors.componentType && <p className="text-red-500 text-sm mt-1">{errors.componentType}</p>}
              </div>
              <div>
                <F9MultiLookup
                  label={t('maintenance.machinesLabel')}
                  value={form.machineIds}
                  onChange={handleMachinesChange}
                  adapter={machineAdapter}
                  items={machineItems}
                  onItemsChange={handleMachineItemsChange}
                  disabled={isReadOnly}
                />
                {errors.machineIds && <p className="text-red-500 text-sm mt-1">{errors.machineIds}</p>}
              </div>
              <Select label={t('maintenance.components.form.criticality')} value={form.criticality} onChange={(e) => setField('criticality', e.target.value)} options={CRITICALITY_KEYS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.select')} error={errors.criticality} disabled={isReadOnly} />
              <Input label={t('maintenance.components.form.manufacturer')} value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} disabled={isReadOnly} />
              <Input label={t('maintenance.components.form.model')} value={form.model} onChange={(e) => setField('model', e.target.value)} disabled={isReadOnly} />
            </div>
            {form.machineIds.length > 0 && (
              <div className="border rounded-lg p-3 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.machineSpecificAttributes')}</h3>
                {form.machineIds.map((machineId) => {
                  const datum = form.machineData[machineId] ?? { locationInMachine: '', serialNumber: '' };
                  const label = machineItems.find((item) => item.id === machineId)?.label || machineId;
                  return (
                    <div key={machineId} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="text-sm font-medium text-gray-700 truncate" title={label}>{label}</div>
                      <Input label={t('maintenance.locationInMachine')} value={datum.locationInMachine} onChange={(e) => handleMachineDataChange(machineId, 'locationInMachine', e.target.value)} disabled={isReadOnly} />
                      <Input label={t('maintenance.serialNumber')} value={datum.serialNumber} onChange={(e) => handleMachineDataChange(machineId, 'serialNumber', e.target.value)} disabled={isReadOnly} />
                    </div>
                  );
                })}
              </div>
            )}
            <div>
              <F9Lookup label={t('maintenance.parentComponent')} value={form.parentComponentId} onChange={(v) => setField('parentComponentId', v)} adapter={machineComponentAdapter} disabled={isReadOnly} />
              <p className="text-xs text-gray-500 mt-1">{t('maintenance.parentSubsetHint')}</p>
            </div>
            <Input label={t('maintenance.components.form.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} disabled={isReadOnly} />
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
