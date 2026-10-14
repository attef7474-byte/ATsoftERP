'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { translateEnum } from '../../../lib/i18n/literals';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Input, Select, Modal, LocalizedValue, PageHeader } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../components/admin/admin-data-grid';
import { LifeStatusBadge } from '../../../components/maintenance/life-status-badge';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon, ActionRecalculateIcon } from '../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, machineComponentAdapter, sparePartAdapter } from '../../../components/f9';
import { useApiErrorHandler } from '../../../components/admin/error-handler';
import { MachineInstalledPart, SparePart } from '../../../lib/admin-types';
import { PERMISSION_KEYS } from '../../../lib/permission-keys';

const INSTALLED_CONDITIONS = ['NEW', 'USED_SERVICEABLE'];
const STATUS_OPTIONS = ['ACTIVE', 'REMOVED', 'REPLACED', 'DECOMMISSIONED'];

const today = () => new Date().toISOString().slice(0, 10);

function newRequestId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function InstalledPartsPage() {
  const { t, dir, locale } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MachineInstalledPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');

  const [registerOpen, setRegisterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSparePart, setSelectedSparePart] = useState<SparePart | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    machineId: '',
    machineComponentId: '',
    sparePartId: '',
    installedQuantity: '1',
    installedCondition: 'NEW',
    installedAt: today(),
    serialNumber: '',
    batchNumber: '',
    notes: '',
    clientRequestId: '',
  });

  const { exec } = useStableHandlers({ refresh: () => fetchData(), evaluate: () => evaluateAll(), register: () => openRegister() });

  useRegisterAdminActions([
    { id: 'register', labelKey: 'maintenance.registerInstalledPart', icon: <ActionAddIcon />, permission: PERMISSION_KEYS.INSTALLED_PARTS_CREATE, onClick: () => exec('register') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'evaluate', labelKey: 'maintenance.evaluateAllParts', icon: <ActionRecalculateIcon />, permission: PERMISSION_KEYS.INSTALLED_PARTS_READ, onClick: () => exec('evaluate'), enabled: !evaluating },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (machineFilter) params.set('machineId', machineFilter);
      const qs = params.toString();
      const res = await api.get<MachineInstalledPart[]>(`/installed-parts${qs ? '?' + qs : ''}`);
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t, statusFilter, machineFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const evaluateAll = useCallback(async () => {
    setEvaluating(true);
    try {
      const res = await api.post<{ evaluated: number }>('/installed-parts/evaluate-expected-life');
      showToast(`${t('maintenance.partsEvaluated')}: ${res?.evaluated ?? 0}`, 'success');
      fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setEvaluating(false); }
  }, [t, fetchData, handleApiError, showToast]);

  const openRegister = useCallback(() => {
    setForm({
      machineId: '', machineComponentId: '', sparePartId: '', installedQuantity: '1',
      installedCondition: 'NEW', installedAt: today(), serialNumber: '', batchNumber: '', notes: '',
      clientRequestId: newRequestId(),
    });
    setSelectedSparePart(null);
    setValidationErrors({});
    setRegisterOpen(true);
  }, []);

  const handleRegister = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!form.machineId) errors.machineId = t('validation.required');
    if (!form.sparePartId) errors.sparePartId = t('validation.required');
    if (form.installedQuantity === '' || Number(form.installedQuantity) <= 0) errors.installedQuantity = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload: any = {
        machineId: form.machineId,
        sparePartId: form.sparePartId,
        installedQuantity: Number(form.installedQuantity),
        installedCondition: form.installedCondition,
        clientRequestId: form.clientRequestId,
      };
      if (form.machineComponentId) payload.machineComponentId = form.machineComponentId;
      if (form.installedAt) payload.installedAt = new Date(form.installedAt).toISOString();
      if (form.serialNumber) payload.serialNumber = form.serialNumber;
      if (form.batchNumber) payload.batchNumber = form.batchNumber;
      if (form.notes) payload.notes = form.notes;

      const res = await api.post<{ applicability?: { applicable: boolean } }>('/installed-parts', payload);
      showToast(t('maintenance.installedPartRegistered'), 'success');
      if (res?.applicability && res.applicability.applicable === false) {
        showToast(t('maintenance.applicabilityWarning'), 'info');
      }
      setRegisterOpen(false);
      fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  }, [form, showToast, t, fetchData, handleApiError]);

  const visibleData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data;
    return data.filter((part) => [
      part.machine?.name, part.machine?.code, part.sparePart?.name, part.sparePart?.code,
      part.machineComponent?.name, part.maintenanceRequest?.requestNumber, part.installedCondition,
      part.life?.lifeStatus, part.serialNumber, part.batchNumber,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const conditionOptions = INSTALLED_CONDITIONS.map((c) => ({ value: c, label: translateEnum(c, locale) }));
  const statusFilterOptions = [{ value: '', label: t('common.all') }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: translateEnum(s, locale) }))];

  const columns: GridColumn<MachineInstalledPart>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (p: MachineInstalledPart) => p.machine ? `[${p.machine.code}] ${p.machine.name}` : '-' },
    { key: 'component', header: t('maintenance.machineComponent'), render: (p: MachineInstalledPart) => p.machineComponent?.name || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (p: MachineInstalledPart) => p.sparePart ? `[${p.sparePart.code}] ${p.sparePart.name}` : '-' },
    { key: 'installedQuantity', header: t('common.quantity'), render: (p: MachineInstalledPart) => p.installedQuantity },
    { key: 'installedCondition', header: t('maintenance.condition'), render: (p: MachineInstalledPart) => <LocalizedValue value={p.installedCondition} /> },
    { key: 'status', header: t('common.status'), render: (p: MachineInstalledPart) => <LocalizedValue kind="status" value={p.status} /> },
    { key: 'life', header: t('maintenance.lifeStatus'), render: (p: MachineInstalledPart) => <LifeStatusBadge status={p.life?.lifeStatus || p.lifeStatus} /> },
    { key: 'installedAt', header: t('maintenance.installedDate'), render: (p: MachineInstalledPart) => new Date(p.installedAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.installedParts')} />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <F9Lookup label={t('maintenance.machine')} value={machineFilter} onChange={setMachineFilter} adapter={machineAdapter} />
        </div>
        <div className="w-48">
          <Select label={t('common.status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusFilterOptions} />
        </div>
      </div>

      <AdminDataGrid
        columns={columns} data={visibleData}
        keyExtractor={(p: MachineInstalledPart) => p.id}
        onRowClick={(p: MachineInstalledPart) => router.push(`/admin/installed-parts/${p.id}`)}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={fetchData}
        dir={dir}
        globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={fetchData} refreshLoading={loading}
      />

      <Modal open={registerOpen} onClose={() => setRegisterOpen(false)} title={t('maintenance.registerInstalledPart')} size="lg">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">{t('maintenance.registerPartHint')}</p>

          <F9Lookup
            label={`${t('maintenance.machine')} *`}
            value={form.machineId}
            onChange={(v) => {
              setForm((prev) => ({ ...prev, machineId: v, machineComponentId: '' }));
              setValidationErrors((prev) => ({ ...prev, machineId: '' }));
            }}
            adapter={machineAdapter}
          />
          {validationErrors.machineId && <p className="text-red-500 text-sm">{validationErrors.machineId}</p>}

          <F9Lookup
            label={t('maintenance.machineComponent')}
            value={form.machineComponentId}
            onChange={(v) => setForm((prev) => ({ ...prev, machineComponentId: v }))}
            adapter={machineComponentAdapter}
            filters={form.machineId ? { machineId: form.machineId } : undefined}
            disabled={!form.machineId}
            placeholder={form.machineId ? undefined : t('maintenance.noMachineSelected')}
          />

          <F9Lookup
            label={`${t('maintenance.sparePartLabel')} *`}
            value={form.sparePartId}
            onChange={(v) => { setForm((prev) => ({ ...prev, sparePartId: v })); setValidationErrors((prev) => ({ ...prev, sparePartId: '' })); }}
            onItemSelect={(sp: SparePart) => setSelectedSparePart(sp)}
            adapter={sparePartAdapter}
          />
          {validationErrors.sparePartId && <p className="text-red-500 text-sm">{validationErrors.sparePartId}</p>}

          {selectedSparePart && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded border bg-gray-50 p-3 text-sm" data-testid="derived-part">
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.derivedProduct')}</p>
                <p className="font-medium">{selectedSparePart.product ? `[${selectedSparePart.product.code}] ${selectedSparePart.product.name}` : '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('common.unit')}</p>
                <p className="font-medium">{selectedSparePart.unit || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.partNumber')}</p>
                <p className="font-medium">{selectedSparePart.partNumber || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.manufacturer')}</p>
                <p className="font-medium">{selectedSparePart.manufacturer || '-'}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={`${t('common.quantity')} *`} type="number" min={0} value={form.installedQuantity} onChange={(e) => { setForm((prev) => ({ ...prev, installedQuantity: e.target.value })); setValidationErrors((prev) => ({ ...prev, installedQuantity: '' })); }} />
              {validationErrors.installedQuantity && <p className="text-red-500 text-sm">{validationErrors.installedQuantity}</p>}
            </div>
            <Select label={t('maintenance.condition')} value={form.installedCondition} onChange={(e) => setForm((prev) => ({ ...prev, installedCondition: e.target.value }))} options={conditionOptions} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.installedDate')} type="date" value={form.installedAt} onChange={(e) => setForm((prev) => ({ ...prev, installedAt: e.target.value }))} />
            <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.batchNumber')} value={form.batchNumber} onChange={(e) => setForm((prev) => ({ ...prev, batchNumber: e.target.value }))} />
            <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setRegisterOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleRegister} loading={saving} disabled={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
