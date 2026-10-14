'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, F9MultiLookup, maintenancePersonnelAdapter, productionLineAdapter, machineAdapter } from '../../../../components/f9';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

interface LabeledTarget { id: string; code: string; name: string }
interface InheritedMachine { id: string; code: string; name: string; productionLineId?: string | null; lineCode?: string | null }
interface EffectiveMachine { id: string; code: string; name: string; source: 'INHERITED' | 'EXPLICIT'; lineCode?: string | null }

interface GroupedAssignment {
  key: string;
  maintenancePersonnelId: string;
  responsibilityRole: string;
  personnel?: { id: string; code: string | null; name: string | null; role: string; specialty?: string | null; phone?: string | null; email?: string | null } | null;
  fullLines: LabeledTarget[];
  inheritedMachines: InheritedMachine[];
  explicitMachines: LabeledTarget[];
  effectiveMachines: EffectiveMachine[];
  isPrimary: boolean;
  startDate: string;
  endDate?: string | null;
  status: string;
  notes?: string | null;
  counts: { fullLines: number; inheritedMachines: number; explicitMachines: number; effectiveMachines: number };
}

const today = () => new Date().toISOString().slice(0, 10);

export default function MachineResponsibilitiesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<GroupedAssignment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupedAssignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [confirmEnd, setConfirmEnd] = useState<GroupedAssignment | null>(null);
  const [inheritedMachines, setInheritedMachines] = useState<InheritedMachine[]>([]);
  const [inheritedLoading, setInheritedLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    maintenancePersonnelId: '',
    responsibilityRole: '',
    fullLineIds: [] as string[],
    explicitMachineIds: [] as string[],
    isPrimary: false,
    startDate: today(),
    endDate: '',
    notes: '',
  });

  const selected = useMemo(() => data.find((d) => d.key === selectedKey), [data, selectedKey]);

  const fullLineItems = useMemo(
    () => (editing?.fullLines ?? []).map((l) => ({ id: l.id, label: `[${l.code}] ${l.name}` })),
    [editing],
  );
  const explicitMachineItems = useMemo(() => {
    const seeded = (editing?.explicitMachines ?? []).map((m) => ({ id: m.id, label: `[${m.code}] ${m.name}` }));
    const inherited = inheritedMachines.map((m) => ({ id: m.id, label: `[${m.code}] ${m.name}` }));
    const map = new Map<string, { id: string; label: string }>();
    for (const it of [...seeded, ...inherited]) map.set(it.id, it);
    return [...map.values()];
  }, [editing, inheritedMachines]);

  const inheritedIds = useMemo(() => new Set(inheritedMachines.map((m) => m.id)), [inheritedMachines]);
  const explicitSelected = form.explicitMachineIds;
  const redundantSelection = explicitSelected.filter((id) => inheritedIds.has(id));
  const effectiveCount = useMemo(
    () => new Set([...inheritedMachines.map((m) => m.id), ...explicitSelected.filter((id) => !inheritedIds.has(id))]).size,
    [inheritedMachines, explicitSelected, inheritedIds],
  );

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await api.get<{ data: GroupedAssignment[]; meta: typeof meta }>(`/maintenance/machine-responsibilities/assignments?${params}`);
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadInherited = useCallback(async (lineIds: string[]) => {
    if (lineIds.length === 0) { setInheritedMachines([]); return; }
    setInheritedLoading(true);
    try {
      const results = await Promise.all(lineIds.map((id) => api.get<{ data: any[] }>(`/maintenance/machines?productionLineId=${encodeURIComponent(id)}&limit=200`)));
      const map = new Map<string, InheritedMachine>();
      for (const res of results) {
        for (const m of res.data ?? []) {
          if (!map.has(m.id)) {
            map.set(m.id, { id: m.id, code: m.code, name: m.name, productionLineId: m.productionLineId ?? null, lineCode: m.productionLine?.code ?? null });
          }
        }
      }
      setInheritedMachines([...map.values()]);
    } catch (e: any) {
      handleApiError(e);
      setInheritedMachines([]);
    } finally {
      setInheritedLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (!modalOpen) return;
    loadInherited(form.fullLineIds);
  }, [modalOpen, form.fullLineIds, loadInherited]);

  const openNew = useCallback(() => {
    setEditing(null);
    setInheritedMachines([]);
    setForm({ maintenancePersonnelId: '', responsibilityRole: '', fullLineIds: [], explicitMachineIds: [], isPrimary: false, startDate: today(), endDate: '', notes: '' });
    setValidationErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((g: GroupedAssignment) => {
    setEditing(g);
    setInheritedMachines(g.inheritedMachines ?? []);
    setForm({
      maintenancePersonnelId: g.maintenancePersonnelId,
      responsibilityRole: g.responsibilityRole,
      fullLineIds: g.fullLines.map((l) => l.id),
      explicitMachineIds: g.explicitMachines.map((m) => m.id),
      isPrimary: g.isPrimary,
      startDate: g.startDate ? g.startDate.slice(0, 10) : today(),
      endDate: g.endDate ? g.endDate.slice(0, 10) : '',
      notes: g.notes ?? '',
    });
    setValidationErrors({});
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!form.maintenancePersonnelId) errors.maintenancePersonnelId = t('validation.required');
    if (!form.responsibilityRole) errors.responsibilityRole = t('validation.required');
    if (form.fullLineIds.length === 0 && form.explicitMachineIds.length === 0) errors.targets = t('maintenance.atLeastOneTarget');
    if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) errors.endDate = t('validation.endDateBeforeStart');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        maintenancePersonnelId: form.maintenancePersonnelId,
        responsibilityRole: form.responsibilityRole,
        fullLineIds: form.fullLineIds,
        explicitMachineIds: form.explicitMachineIds,
        isPrimary: form.isPrimary,
      };
      if (!editing) payload.startDate = new Date(form.startDate).toISOString();
      else payload.startDate = new Date(form.startDate).toISOString();
      if (form.endDate) payload.endDate = new Date(form.endDate).toISOString();
      if (form.notes) payload.notes = form.notes;

      if (editing) {
        await api.patch('/maintenance/machine-responsibilities/batch', payload);
        showToast(t('maintenance.responsibilityAssigned'), 'success');
      } else {
        await api.post('/maintenance/machine-responsibilities/batch', payload);
        showToast(t('maintenance.responsibilityAssigned'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [form, editing, meta.page, showToast, t, fetchData, handleApiError]);

  const handleEnd = useCallback(async () => {
    if (!confirmEnd) return;
    setConfirmEnd(null);
    try {
      await api.post('/maintenance/machine-responsibilities/end', {
        maintenancePersonnelId: confirmEnd.maintenancePersonnelId,
        responsibilityRole: confirmEnd.responsibilityRole,
      });
      showToast(t('maintenance.responsibilityEnded'), 'success');
      if (selectedKey === confirmEnd.key) setSelectedKey('');
      fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
  }, [confirmEnd, selectedKey, meta.page, showToast, t, fetchData, handleApiError]);

  const { exec } = useStableHandlers({ add: () => openNew(), edit: () => selected && openEdit(selected), refresh: () => fetchData(meta.page), end: () => selected && setConfirmEnd(selected) });
  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'actions.add', icon: React.createElement(ActionAddIcon), permission: 'machine-responsibility:create', onClick: () => exec('add') },
    { id: 'edit', labelKey: 'common.edit', icon: React.createElement(ActionEditIcon), permission: 'machine-responsibility:update', onClick: () => exec('edit'), enabled: !!selected },
    { id: 'refresh', labelKey: 'common.refresh', icon: React.createElement(ActionRefreshIcon), onClick: () => exec('refresh') },
    { id: 'end', labelKey: 'actions.deactivate', icon: React.createElement(ActionDeleteIcon), variant: 'danger', permission: 'machine-responsibility:delete', onClick: () => exec('end'), enabled: !!selected },
  ], [exec, selected]));

  const targetLabel = (items: LabeledTarget[]) => items.length === 0 ? '-' : items.map((i) => `[${i.code}] ${i.name}`).join(', ');

  const columns: GridColumn<GroupedAssignment>[] = [
    { key: 'personnel', header: t('maintenance.personnel'), render: (r) => r.personnel ? `[${r.personnel.code}] ${r.personnel.name}` : '-' },
    { key: 'responsibilityRole', header: t('maintenance.responsibilityRole') },
    { key: 'fullLines', header: t('maintenance.fullProductionLines'), render: (r) => targetLabel(r.fullLines) },
    { key: 'explicitMachines', header: t('maintenance.explicitMachines'), render: (r) => targetLabel(r.explicitMachines) },
    { key: 'effectiveMachines', header: t('maintenance.effectiveMachines'), render: (r) => String(r.counts.effectiveMachines) },
    { key: 'isPrimary', header: t('maintenance.isPrimary'), render: (r) => r.isPrimary ? t('common.yes') : t('common.no') },
    { key: 'startDate', header: t('maintenance.startDate'), render: (r) => r.startDate ? new Date(r.startDate).toLocaleDateString() : '-' },
    { key: 'endDate', header: t('maintenance.endDate'), render: (r) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '-' },
    { key: 'status', header: t('common.status') },
  ];

  const gridActions: GridAction<GroupedAssignment>[] = [
    { label: t('actions.edit'), permission: 'machine-responsibility:update', onClick: (s) => openEdit(s) },
    { label: t('actions.deactivate'), permission: 'machine-responsibility:delete', onClick: (s) => setConfirmEnd(s), variant: 'danger', enabled: (s) => s.status === 'ACTIVE' },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.machineResponsibilities')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<GroupedAssignment>
        columns={columns} data={data} keyExtractor={(s) => s.key}
        selectedKey={selectedKey} loading={loading} emptyMessage={t('common.noRecords')}
        error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={gridActions} globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRowClick={(s) => setSelectedKey(s.key === selectedKey ? '' : s.key)}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />

      {selected && (
        <div className="mt-4 border rounded-lg p-4 bg-white" data-testid="responsibility-details">
          <h3 className="font-semibold mb-2">{t('maintenance.machineCoverage')}</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div><dt className="text-gray-500">{t('maintenance.fullProductionLines')}</dt><dd>{targetLabel(selected.fullLines)}</dd></div>
            <div><dt className="text-gray-500">{t('maintenance.explicitMachines')}</dt><dd>{targetLabel(selected.explicitMachines)}</dd></div>
            <div><dt className="text-gray-500">{t('maintenance.inheritedMachines')}</dt><dd>{selected.counts.inheritedMachines}</dd></div>
            <div><dt className="text-gray-500">{t('maintenance.effectiveMachines')}</dt><dd>{selected.counts.effectiveMachines}</dd></div>
          </dl>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('common.edit') : t('common.new')}>
        <div className="space-y-4">
          <F9Lookup
            label={`${t('maintenance.personnel')} *`}
            value={form.maintenancePersonnelId}
            onChange={(v) => { setForm((prev) => ({ ...prev, maintenancePersonnelId: v })); setValidationErrors((prev) => ({ ...prev, maintenancePersonnelId: '' })); }}
            adapter={maintenancePersonnelAdapter}
            disabled={!!editing}
          />
          {validationErrors.maintenancePersonnelId && <p className="text-red-500 text-sm">{validationErrors.maintenancePersonnelId}</p>}

          <Input
            label={`${t('maintenance.responsibilityRole')} *`}
            value={form.responsibilityRole}
            onChange={(e) => { setForm((prev) => ({ ...prev, responsibilityRole: e.target.value })); setValidationErrors((prev) => ({ ...prev, responsibilityRole: '' })); }}
            disabled={!!editing}
          />
          {validationErrors.responsibilityRole && <p className="text-red-500 text-sm">{validationErrors.responsibilityRole}</p>}

          <div>
            <F9MultiLookup
              label={t('maintenance.fullProductionLines')}
              value={form.fullLineIds}
              onChange={(ids) => { setForm((prev) => ({ ...prev, fullLineIds: ids })); setValidationErrors((prev) => ({ ...prev, targets: '' })); }}
              adapter={productionLineAdapter}
              items={fullLineItems}
            />
            <p className="mt-1 text-xs text-gray-500">{t('maintenance.lineCoverageHint')}</p>
          </div>

          <div>
            <F9MultiLookup
              label={t('maintenance.explicitMachines')}
              value={form.explicitMachineIds}
              onChange={(ids) => { setForm((prev) => ({ ...prev, explicitMachineIds: ids })); setValidationErrors((prev) => ({ ...prev, targets: '' })); }}
              adapter={machineAdapter}
              items={explicitMachineItems}
            />
          </div>
          {validationErrors.targets && <p className="text-red-500 text-sm">{validationErrors.targets}</p>}

          <div className="border rounded p-3 bg-gray-50" data-testid="effective-coverage">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t('maintenance.effectiveMachines')}</span>
              <span data-testid="effective-count">{effectiveCount}</span>
            </div>
            {inheritedLoading && <p className="text-xs text-gray-500 mt-1">{t('common.loading')}</p>}
            <ul className="mt-2 flex flex-wrap gap-1">
              {inheritedMachines.map((m) => (
                <li key={`inh-${m.id}`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                  <span>[{m.code}] {m.name}</span>
                  <span className="text-blue-500">· {t('maintenance.includedByLine')}{m.lineCode ? ` (${m.lineCode})` : ''}</span>
                </li>
              ))}
              {explicitSelected.filter((id) => !inheritedIds.has(id)).map((id) => {
                const item = explicitMachineItems.find((i) => i.id === id);
                return <li key={`exp-${id}`} className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800">{item?.label ?? id}</li>;
              })}
            </ul>
            {inheritedMachines.length > 0 && <p className="mt-2 text-xs text-gray-500">{t('maintenance.inheritedLockedHint')}</p>}
            {redundantSelection.length > 0 && <p className="mt-2 text-xs text-amber-600" data-testid="redundant-hint">{t('maintenance.machineCoveredByLine')}</p>}
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} className="rounded" />
            {t('maintenance.isPrimary')}
          </label>
          <Input label={t('maintenance.startDate')} type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
          <Input label={t('maintenance.endDate')} type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
          {validationErrors.endDate && <p className="text-red-500 text-sm">{validationErrors.endDate}</p>}
          <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmEnd}
        onClose={() => setConfirmEnd(null)}
        onConfirm={handleEnd}
        title={t('maintenance.responsibilityEnded')}
        message={t('maintenance.confirmEndResponsibility')}
        variant="danger"
      />
    </div>
  );
}
