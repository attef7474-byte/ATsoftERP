'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { DowntimeLog } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, maintenanceRequestAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function DowntimeLogsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<DowntimeLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<DowntimeLog | null>(null);
  const [form, setForm] = useState({ machineId: '', requestId: '', reason: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    close: () => confirmAction(selectedId, 'close'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'close', labelKey: 'common.close', icon: <ActionCancelIcon />, onClick: () => exec('close'), enabled: !!(selectedId && !selectedRecord?.endTime) },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: DowntimeLog[]; meta: any }>('/maintenance/downtime-logs', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { router.push('/admin/maintenance/downtime-logs/new'); };
  const openEdit = (item: DowntimeLog) => { router.push(`/admin/maintenance/downtime-logs/${item.id}/edit`); };

  const handleSave = async () => {
    if (!form.machineId || !form.reason) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, reason: form.reason };
      if (form.requestId) payload.requestId = form.requestId;
      if (form.notes) payload.notes = form.notes;
      if (editItem) {
        await api.patch(`/maintenance/downtime-logs/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/downtime-logs', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/maintenance/downtime-logs/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'machine', header: t('maintenance.machine'), render: (d: DowntimeLog) => d.machine?.name || '-' },
    { key: 'reason', header: t('maintenance.reason') },
    { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => new Date(d.startTime).toLocaleString() },
    { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? new Date(d.endTime).toLocaleString() : '-' },
    { key: 'durationMinutes', header: t('maintenance.durationMinutes'), render: (d: DowntimeLog) => d.durationMinutes ? `${d.durationMinutes} min` : '-' },
    { key: 'status', header: t('common.status'), render: (d: DowntimeLog) => <CmmsStatusBadge status={d.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (d: DowntimeLog) => (
        <div className="flex gap-2 flex-wrap">
          {!d.endTime && <button onClick={() => confirmAction(d.id, 'close')} className="text-green-600 hover:text-green-800 text-sm">{t('maintenance.close')}</button>}
          <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.downtimeLogs')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newDowntimeLog')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(d: DowntimeLog) => d.id} onRowClick={(item: DowntimeLog) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editDowntimeLog') : t('maintenance.newDowntimeLog')} size="lg">
        <div className="space-y-4">
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setForm({ ...form, requestId: v })} adapter={maintenanceRequestAdapter} />
          <Input label={t('maintenance.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')} variant="primary" loading={saving} />
    </div>
  );
}
