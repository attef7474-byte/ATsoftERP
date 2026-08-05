'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionNcr, ProductionInspection } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionInspectionAdapter, userAdapter } from '../../../../../components/f9';

const NCR_STATUSES = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'VERIFIED', 'CLOSED'];
const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];

function statusLabelKey(value: string): string {
  return 'production.ncrs.status' + value;
}

function severityLabelKey(value: string): string {
  return 'production.ncrs.severity' + value;
}

function actionLabelKey(value: string): string {
  return 'production.ncrs.action' + value;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type DetailTab = 'details' | 'transitions' | 'attachments';

interface TransitionOption {
  action: string;
  toStatus: string;
}

function transitionOptionsFor(status: string): TransitionOption[] {
  switch (status) {
    case 'OPEN':
      return [{ action: 'START_INVESTIGATION', toStatus: 'INVESTIGATING' }];
    case 'INVESTIGATING':
      return [
        { action: 'REQUEST_ACTION', toStatus: 'ACTION_REQUIRED' },
        { action: 'REOPEN', toStatus: 'OPEN' },
      ];
    case 'ACTION_REQUIRED':
      return [{ action: 'VERIFY', toStatus: 'VERIFIED' }];
    case 'VERIFIED':
      return [
        { action: 'CLOSE', toStatus: 'CLOSED' },
        { action: 'REVISE', toStatus: 'ACTION_REQUIRED' },
      ];
    default:
      return [];
  }
}

export default function ProductionNcrsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionNcr[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    clientRequestId: '',
    inspectionId: '',
    dispositionId: '',
    severity: 'MAJOR',
    description: '',
    rootCause: '',
    correctiveAction: '',
    ownerUserId: '',
    detectionDate: '',
    targetDate: '',
  });
  const [inspectionDispositions, setInspectionDispositions] = useState<{ id: string; action: string; quantity: number; unit: string; status: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ProductionNcr | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');

  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionForm, setTransitionForm] = useState({ action: '', toStatus: '', requestId: '', reason: '' });

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachmentId, setAttachmentId] = useState('');
  const [confirmDetach, setConfirmDetach] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState('');

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      const res = await api.get<{ data: ProductionNcr[]; meta: any }>('/production/ncrs', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, severityFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({
      clientRequestId: newUuid(),
      inspectionId: '',
      dispositionId: '',
      severity: 'MAJOR',
      description: '',
      rootCause: '',
      correctiveAction: '',
      ownerUserId: '',
      detectionDate: new Date().toISOString().slice(0, 10),
      targetDate: '',
    });
    setInspectionDispositions([]);
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleInspectionSelected = async (item: ProductionInspection) => {
    setForm((prev) => ({ ...prev, inspectionId: item.id, dispositionId: '' }));
    setInspectionDispositions([]);
    try {
      const inspection = await api.get<ProductionInspection>(`/production/inspections/${item.id}`);
      setInspectionDispositions(inspection.dispositions || []);
    } catch (err: any) { handleApiError(err); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.clientRequestId) errors.clientRequestId = t('production.ncrs.errors.clientRequestIdRequired');
    if (!form.description) errors.description = t('production.ncrs.errors.descriptionRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        clientRequestId: form.clientRequestId,
        inspectionId: form.inspectionId || undefined,
        dispositionId: form.dispositionId || undefined,
        severity: form.severity,
        description: form.description,
        rootCause: form.rootCause || undefined,
        correctiveAction: form.correctiveAction || undefined,
        ownerUserId: form.ownerUserId || undefined,
        detectionDate: form.detectionDate || undefined,
        targetDate: form.targetDate || undefined,
      };
      await api.post('/production/ncrs', payload);
      showToast(t('production.ncrs.createCompleted'), 'success');
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailTab('details');
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const item = await api.get<ProductionNcr>(`/production/ncrs/${id}`);
      setDetail(item);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const item = await api.get<ProductionNcr>(`/production/ncrs/${detail.id}`);
      setDetail(item);
    } catch (err: any) { handleApiError(err); }
  };

  // ── Transitions ──────────────────────────────────────────────────

  const openTransition = () => {
    if (!detail) return;
    const options = transitionOptionsFor(detail.status);
    if (options.length === 0) return;
    setTransitionForm({ action: options[0].action, toStatus: options[0].toStatus, requestId: newUuid(), reason: '' });
    setTransitionOpen(true);
  };

  const applyTransition = async () => {
    if (!detail) return;
    if (!transitionForm.action || !transitionForm.toStatus) {
      showToast(t('production.ncrs.errors.actionRequired'), 'error');
      return;
    }
    if (!transitionForm.requestId) {
      showToast(t('production.ncrs.errors.requestIdRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/production/ncrs/${detail.id}/transition`, {
        action: transitionForm.action,
        toStatus: transitionForm.toStatus,
        requestId: transitionForm.requestId,
        reason: transitionForm.reason || undefined,
      });
      showToast(t('production.ncrs.transitionCompleted'), 'success');
      setTransitionOpen(false);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Attachments ──────────────────────────────────────────────────

  const attachDocument = async () => {
    if (!detail) return;
    if (!attachmentId) {
      showToast(t('production.ncrs.errors.attachmentRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/production/ncrs/${detail.id}/attachments`, { attachmentId });
      showToast(t('production.ncrs.attachCompleted'), 'success');
      setAttachOpen(false);
      setAttachmentId('');
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const detachDocument = async () => {
    if (!detail || !confirmDetach) return;
    setSaving(true);
    try {
      await api.delete(`/production/ncrs/${detail.id}/attachments/${confirmDetach}`);
      showToast(t('production.ncrs.detachCompleted'), 'success');
      setConfirmDetach(null);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionNcr>[] = [
    { key: 'ncrNumber', header: t('production.ncrs.ncrNumber'), render: (r) => r.ncrNumber },
    { key: 'severity', header: t('production.ncrs.severity'), render: (r) => t(severityLabelKey(r.severity)) },
    { key: 'status', header: t('production.ncrs.status'), render: (r) => <CmmsStatusBadge status={r.status} /> },
    { key: 'inspection', header: t('production.ncrs.inspection'), render: (r) => r.inspection?.inspectionNumber || '-' },
    { key: 'description', header: t('production.ncrs.description'), render: (r) => r.description },
    { key: 'detectionDate', header: t('production.ncrs.detectionDate'), render: (r) => new Date(r.detectionDate).toLocaleDateString() },
  ];

  const gridActions: GridAction<ProductionNcr>[] = [
    { label: t('actions.view'), onClick: (r) => openDetail(r.id) },
    { label: t('production.ncrs.transition'), onClick: (r) => openDetail(r.id).then(() => setDetailTab('transitions')), enabled: (r) => transitionOptionsFor(r.status).length > 0 },
  ];

  const options = detail ? transitionOptionsFor(detail.status) : [];

  return (
    <div>
      <PageHeader title={t('production.ncrs.title')} />
      <div className="mb-4 flex max-w-xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.ncrs.allStatuses')}
          options={NCR_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
        <Select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          placeholder={t('production.ncrs.severity')}
          options={SEVERITIES.map((value) => ({ value, label: t(severityLabelKey(value)) }))}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('production.ncrs.newNcr')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <F9Lookup
                label={t('production.ncrs.inspection')}
                adapter={productionInspectionAdapter}
                value={form.inspectionId}
                onItemSelect={handleInspectionSelected}
                onChange={(value) => { if (!value) { setForm({ ...form, inspectionId: '', dispositionId: '' }); setInspectionDispositions([]); } }}
              />
            </div>
            <div>
              <Select
                label={t('production.ncrs.disposition')}
                value={form.dispositionId}
                onChange={(e) => setForm({ ...form, dispositionId: e.target.value })}
                placeholder={t('common.none')}
                options={inspectionDispositions.map((d) => ({
                  value: d.id,
                  label: `${d.action} - ${d.quantity} ${d.unit} (${d.status})`,
                }))}
              />
            </div>
            <div>
              <Select
                label={t('production.ncrs.severity')}
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                options={SEVERITIES.map((value) => ({ value, label: t(severityLabelKey(value)) }))}
              />
            </div>
          </div>
          <div>
            <Textarea label={t('production.ncrs.description')} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setValidationErrors(prev => ({ ...prev, description: '' })); }} required />
            {validationErrors.description && <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Textarea label={t('production.ncrs.rootCause')} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} />
            <Textarea label={t('production.ncrs.correctiveAction')} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input label={t('production.ncrs.detectionDate')} type="date" value={form.detectionDate} onChange={(e) => setForm({ ...form, detectionDate: e.target.value })} />
            </div>
            <div>
              <Input label={t('production.ncrs.targetDate')} type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </div>
            <F9Lookup
              label={t('production.ncrs.owner')}
              adapter={userAdapter}
              value={form.ownerUserId}
              onChange={(value) => setForm({ ...form, ownerUserId: value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? detail.ncrNumber : ''} size="lg">
        {detailLoading || !detail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div>
            <div className="mb-4 flex gap-2 border-b border-gray-200">
              {(['details', 'transitions', 'attachments'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${detailTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t('production.ncrs.' + tab)}
                </button>
              ))}
            </div>

            {detailTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><div className="text-gray-500">{t('production.ncrs.severity')}</div><div className="font-medium">{t(severityLabelKey(detail.severity))}</div></div>
                  <div><div className="text-gray-500">{t('production.ncrs.status')}</div><div><CmmsStatusBadge status={detail.status} /></div></div>
                  <div><div className="text-gray-500">{t('production.ncrs.inspection')}</div><div className="font-medium">{detail.inspection?.inspectionNumber || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.ncrs.disposition')}</div><div className="font-medium">{detail.disposition ? `${detail.disposition.action} - ${detail.disposition.quantity} ${detail.disposition.unit}` : '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.ncrs.detectionDate')}</div><div className="font-medium">{new Date(detail.detectionDate).toLocaleDateString()}</div></div>
                  <div><div className="text-gray-500">{t('production.ncrs.targetDate')}</div><div className="font-medium">{detail.targetDate ? new Date(detail.targetDate).toLocaleDateString() : '-'}</div></div>
                  <div className="col-span-3"><div className="text-gray-500">{t('production.ncrs.description')}</div><div className="font-medium">{detail.description}</div></div>
                  {detail.rootCause && <div className="col-span-3"><div className="text-gray-500">{t('production.ncrs.rootCause')}</div><div className="font-medium">{detail.rootCause}</div></div>}
                  {detail.correctiveAction && <div className="col-span-3"><div className="text-gray-500">{t('production.ncrs.correctiveAction')}</div><div className="font-medium">{detail.correctiveAction}</div></div>}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setDetailOpen(false)}>{t('actions.cancel')}</Button>
                  {options.length > 0 && (
                    <Button onClick={openTransition}>{t('production.ncrs.transition')}</Button>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'transitions' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  {options.length > 0 && (
                    <Button onClick={openTransition} size="sm">{t('production.ncrs.transition')}</Button>
                  )}
                </div>
                {(detail.transitions || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.action')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.status')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.reason')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.detectionDate')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detail.transitions || []).map((tr) => (
                          <tr key={tr.id}>
                            <td className="px-3 py-2">{t(actionLabelKey(tr.action) || '')}</td>
                            <td className="px-3 py-2">{t(statusLabelKey(tr.fromStatus))} → {t(statusLabelKey(tr.toStatus))}</td>
                            <td className="px-3 py-2">{tr.reason || '-'}</td>
                            <td className="px-3 py-2">{new Date(tr.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'attachments' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={() => { setAttachmentId(''); setAttachOpen(true); }} size="sm">{t('production.ncrs.attachDocument')}</Button>
                </div>
                {(detail.attachments || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.ncrNumber')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.attachments')}</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detail.attachments || []).map((a) => (
                          <tr key={a.id}>
                            <td className="px-3 py-2">{a.attachment?.originalName || a.attachmentId}</td>
                            <td className="px-3 py-2">
                              <div className="text-xs text-gray-500">{a.attachment?.mimeType} · {a.attachment?.size} bytes</div>
                              <div className="text-xs text-gray-400">{new Date(a.attachment?.createdAt || a.createdAt).toLocaleString()}</div>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button type="button" className="text-red-600 hover:text-red-800" onClick={() => setConfirmDetach(a.id)}>{t('production.ncrs.detach')}</button>
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

      <Modal open={transitionOpen} onClose={() => setTransitionOpen(false)} title={t('production.ncrs.transition')} size="md">
        <div className="space-y-4">
          <div>
            <Select
              label={t('production.ncrs.action')}
              value={transitionForm.action}
              onChange={(e) => {
                const selected = options.find((o) => o.action === e.target.value);
                setTransitionForm({ ...transitionForm, action: e.target.value, toStatus: selected ? selected.toStatus : '' });
              }}
              options={options.map((o) => ({ value: o.action, label: t(actionLabelKey(o.action)) }))}
            />
          </div>
          <div>
            <p className="text-sm text-gray-500">
              {detail ? `${t(statusLabelKey(detail.status))} → ${t(statusLabelKey(transitionForm.toStatus))}` : ''}
            </p>
          </div>
          <Textarea label={t('production.ncrs.reason')} value={transitionForm.reason} onChange={(e) => setTransitionForm({ ...transitionForm, reason: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setTransitionOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={applyTransition} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title={t('production.ncrs.attachDocument')} size="md">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">{t('production.ncrs.attachHint')}</p>
          <Input label={t('production.ncrs.selectAttachment')} value={attachmentId} onChange={(e) => setAttachmentId(e.target.value)} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setAttachOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={attachDocument} loading={saving}>{t('production.ncrs.attachDocument')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDetach}
        onClose={() => setConfirmDetach(null)}
        onConfirm={detachDocument}
        title={t('production.ncrs.detachConfirmation')}
        message={t('production.ncrs.detachConfirmation')}
        loading={saving}
      />
    </div>
  );
}
