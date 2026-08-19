'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { Button, Input, Select, Pagination, PageHeader, Modal, Textarea } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, departmentAdapter, productionShiftAdapter, operationalPersonAdapter } from '../../../../components/f9';

interface ShiftHandover {
  id: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  handoverDate: string;
  outgoingShiftId: string;
  incomingShiftId: string;
  outgoingPersonId?: string | null;
  incomingPersonId?: string | null;
  activeProductionOrders?: number | null;
  openMaintenanceRequests?: number | null;
  stoppedMachines?: number | null;
  pendingMaintenance?: number | null;
  notes?: string | null;
  status: string;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  createdByUserId?: string | null;
  outgoingShift?: { id: string; code: string; name: string; startTime?: string; endTime?: string };
  incomingShift?: { id: string; code: string; name: string; startTime?: string; endTime?: string };
  outgoingPerson?: { id: string; code: string; name: string } | null;
  incomingPerson?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  branch?: { id: string; code: string; name: string } | null;
  items?: any[];
}

const HANDOVER_STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'];

function statusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-blue-100 text-blue-800';
    case 'SUBMITTED': return 'bg-amber-100 text-amber-800';
    case 'ACKNOWLEDGED': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function ShiftHandoversPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const router = useRouter();
  const [data, setData] = useState<ShiftHandover[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    departmentId: '',
    outgoingShiftId: '',
    incomingShiftId: '',
    outgoingPersonId: '',
    incomingPersonId: '',
    handoverDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (dateFrom) params.handoverDateFrom = dateFrom;
      if (dateTo) params.handoverDateTo = dateTo;
      const res = await api.get<{ data: ShiftHandover[]; meta: any }>('/production/shift-handovers', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({
      departmentId: '',
      outgoingShiftId: '',
      incomingShiftId: '',
      outgoingPersonId: '',
      incomingPersonId: '',
      handoverDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.outgoingShiftId) errors.outgoingShiftId = t('validation.required');
    if (!form.incomingShiftId) errors.incomingShiftId = t('validation.required');
    if (!form.handoverDate) errors.handoverDate = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.post('/production/shift-handovers', {
        departmentId: form.departmentId || undefined,
        outgoingShiftId: form.outgoingShiftId,
        incomingShiftId: form.incomingShiftId,
        outgoingPersonId: form.outgoingPersonId || undefined,
        incomingPersonId: form.incomingPersonId || undefined,
        handoverDate: form.handoverDate,
        notes: form.notes || undefined,
      });
      showToast(t('common.successCreated'), 'success');
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColumn<ShiftHandover>[] = [
    { key: 'handoverDate', header: t('production.shiftHandovers.handoverDate'), render: (s) => new Date(s.handoverDate).toLocaleDateString() },
    { key: 'outgoingShift', header: t('production.shiftHandovers.outgoingShift'), render: (s) => s.outgoingShift ? `${s.outgoingShift.code} - ${s.outgoingShift.name}` : '-' },
    { key: 'incomingShift', header: t('production.shiftHandovers.incomingShift'), render: (s) => s.incomingShift ? `${s.incomingShift.code} - ${s.incomingShift.name}` : '-' },
    { key: 'outgoingPerson', header: t('production.shiftHandovers.outgoingPerson'), render: (s) => s.outgoingPerson ? s.outgoingPerson.name : '-' },
    { key: 'incomingPerson', header: t('production.shiftHandovers.incomingPerson'), render: (s) => s.incomingPerson ? s.incomingPerson.name : '-' },
    { key: 'status', header: t('common.status'), render: (s) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{t('production.shiftHandovers.status' + s.status)}</span> },
    { key: 'items', header: t('production.shiftHandovers.itemsCount'), render: (s) => String(s.items?.length || 0) },
  ];

  return (
    <div>
      <PageHeader title={t('production.shiftHandovers.label')} />
      <div className="mb-4 flex max-w-3xl gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.shiftHandovers.allStatuses')}
          options={HANDOVER_STATUSES.map((v) => ({ value: v, label: t('production.shiftHandovers.status' + v) }))}
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder={t('production.shiftHandovers.dateFrom')}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder={t('production.shiftHandovers.dateTo')}
        />
        <Button variant="secondary" onClick={() => fetchData(1)}>{t('actions.apply')}</Button>
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => router.push(`/admin/production/shift-handovers/${s.id}`)}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('production.shiftHandovers.newHandover')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup
              label={t('production.shiftHandovers.department')}
              value={form.departmentId}
              adapter={departmentAdapter}
              onChange={(v) => setForm({ ...form, departmentId: v })}
            />
            <div>
              <Input
                label={t('production.shiftHandovers.handoverDate')}
                type="date"
                value={form.handoverDate}
                onChange={(e) => { setForm({ ...form, handoverDate: e.target.value }); setValidationErrors((prev) => ({ ...prev, handoverDate: '' })); }}
                required
              />
              {validationErrors.handoverDate && <p className="text-red-500 text-sm mt-1">{validationErrors.handoverDate}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup
                label={t('production.shiftHandovers.outgoingShift')}
                value={form.outgoingShiftId}
                adapter={productionShiftAdapter}
                onChange={(v) => { setForm({ ...form, outgoingShiftId: v }); setValidationErrors((prev) => ({ ...prev, outgoingShiftId: '' })); }}
              />
              {validationErrors.outgoingShiftId && <p className="text-red-500 text-sm mt-1">{validationErrors.outgoingShiftId}</p>}
            </div>
            <div>
              <F9Lookup
                label={t('production.shiftHandovers.incomingShift')}
                value={form.incomingShiftId}
                adapter={productionShiftAdapter}
                onChange={(v) => { setForm({ ...form, incomingShiftId: v }); setValidationErrors((prev) => ({ ...prev, incomingShiftId: '' })); }}
              />
              {validationErrors.incomingShiftId && <p className="text-red-500 text-sm mt-1">{validationErrors.incomingShiftId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup
              label={t('production.shiftHandovers.outgoingPerson')}
              value={form.outgoingPersonId}
              adapter={operationalPersonAdapter}
              onChange={(v) => setForm({ ...form, outgoingPersonId: v })}
            />
            <F9Lookup
              label={t('production.shiftHandovers.incomingPerson')}
              value={form.incomingPersonId}
              adapter={operationalPersonAdapter}
              onChange={(v) => setForm({ ...form, incomingPersonId: v })}
            />
          </div>
          <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
