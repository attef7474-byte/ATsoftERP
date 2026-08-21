'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { OperationalPersonAssignment, PaginationMeta, TransferPreviewResponse, TransferApplyResponse, AffectedRelationship, RelationshipResolutionAction } from '@/lib/admin-types';
import { Button, Input, Card, LoadingState, Modal, StatusBadge, Pagination, ConfirmDialog } from '@/components/admin/ui';
import { F9Lookup, operationalPersonAdapter, branchAdapter, administrationAdapter, departmentAdapter, jobTitleAdapter } from '@/components/f9';
import { Search, Plus, Edit, Trash2, RefreshCw, Users, ArrowRightLeft } from 'lucide-react';

interface AssignmentForm {
  personnelId: string;
  departmentId: string;
  jobTitleId: string;
  assignmentType: string;
  leadershipLevel: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

interface TransferForm {
  branchId: string;
  administrationId: string;
  departmentId: string;
  jobTitleId: string;
  leadershipLevel: string;
  effectiveFrom: string;
  notes: string;
}

const EMPTY_FORM: AssignmentForm = { personnelId: '', departmentId: '', jobTitleId: '', assignmentType: 'PRIMARY', leadershipLevel: 'NONE', effectiveFrom: '', effectiveTo: '', notes: '' };
const EMPTY_TRANSFER_FORM: TransferForm = { branchId: '', administrationId: '', departmentId: '', jobTitleId: '', leadershipLevel: 'NONE', effectiveFrom: '', notes: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };
const ASSIGNMENT_TYPES = ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'];
const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];

export default function PersonAssignmentsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<OperationalPersonAssignment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [transferModal, setTransferModal] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferRecord, setTransferRecord] = useState<OperationalPersonAssignment | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>(EMPTY_TRANSFER_FORM);
  const [transferStep, setTransferStep] = useState(1);
  const [transferPreview, setTransferPreview] = useState<TransferPreviewResponse | null>(null);
  const [transferResolutions, setTransferResolutions] = useState<Record<string, RelationshipResolutionAction>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<TransferApplyResponse | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/person-assignments', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
      setData(res.data);
      setMeta(res.meta);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(1, search); }, []);

  const handleSearch = () => fetchData(1, search);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEditModal = (record: OperationalPersonAssignment) => {
    setEditingId(record.id);
    setForm({
      personnelId: record.personnelId,
      departmentId: record.departmentId,
      jobTitleId: record.jobTitleId || '',
      assignmentType: record.assignmentType,
      leadershipLevel: record.leadershipLevel || 'NONE',
      effectiveFrom: record.effectiveFrom.split('T')[0],
      effectiveTo: record.effectiveTo ? record.effectiveTo.split('T')[0] : '',
      notes: record.notes || '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const fieldErrors: Record<string, string> = {};
    if (!form.personnelId) fieldErrors.personnelId = t('validation.required');
    if (!form.departmentId) fieldErrors.departmentId = t('validation.required');
    if (!form.effectiveFrom) fieldErrors.effectiveFrom = t('validation.required');
    if (Object.keys(fieldErrors).length > 0) {
      setValidationErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form, effectiveTo: form.effectiveTo || null, jobTitleId: form.jobTitleId || null };
      if (editingId) {
        await api.patch(`/person-assignments/${editingId}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/person-assignments', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page, search);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openTransferModal = (record: OperationalPersonAssignment) => {
    setTransferId(record.id);
    setTransferRecord(record);
    setTransferForm({
      branchId: '',
      administrationId: '',
      departmentId: '',
      jobTitleId: '',
      leadershipLevel: 'NONE',
      effectiveFrom: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setTransferStep(1);
    setTransferPreview(null);
    setTransferResolutions({});
    setTransferResult(null);
    setTransferModal(true);
  };

  const handlePreviewTransfer = async () => {
    if (!transferId || !transferForm.departmentId || !transferForm.effectiveFrom) return;
    setPreviewLoading(true);
    try {
      const res = await api.post(`/person-assignments/${transferId}/transfer/preview`, {
        departmentId: transferForm.departmentId,
        branchId: transferForm.branchId || undefined,
        administrationId: transferForm.administrationId || undefined,
        jobTitleId: transferForm.jobTitleId || undefined,
        leadershipLevel: transferForm.leadershipLevel || 'NONE',
        effectiveFrom: transferForm.effectiveFrom,
        effectiveTo: undefined,
        notes: transferForm.notes || undefined,
      }) as any;
      setTransferPreview(res);
      const autoResolutions: Record<string, RelationshipResolutionAction> = {};
      for (const rel of res.affectedRelationships || []) {
        if (rel.allowedResolutions.length === 1) {
          autoResolutions[rel.id] = rel.allowedResolutions[0];
        }
      }
      setTransferResolutions(autoResolutions);
      setTransferStep(2);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.loadFailed'), 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyTransfer = async () => {
    if (!transferId || !transferForm.departmentId || !transferForm.effectiveFrom) return;
    setSaving(true);
    try {
      const resolutions = (transferPreview?.affectedRelationships || [])
        .filter(r => r.temporalCategory !== 'HISTORICAL' && r.allowedResolutions.length > 0)
        .map(r => ({ relationshipId: r.id, action: transferResolutions[r.id] }))
        .filter(r => r.action);
      const res = await api.post(`/person-assignments/${transferId}/transfer`, {
        departmentId: transferForm.departmentId,
        branchId: transferForm.branchId || undefined,
        administrationId: transferForm.administrationId || undefined,
        jobTitleId: transferForm.jobTitleId || undefined,
        leadershipLevel: transferForm.leadershipLevel || 'NONE',
        effectiveFrom: transferForm.effectiveFrom,
        effectiveTo: undefined,
        notes: transferForm.notes || undefined,
        relationshipResolutions: resolutions.length > 0 ? resolutions : undefined,
      }) as any;
      setTransferResult(res);
      setTransferStep(4);
      showToast(t('core.transferSuccess'), 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('core.transferFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/person-assignments/${deleteTarget}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDelete(false);
      setDeleteTarget(null);
      fetchData(meta.page, search);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.deleteFailed'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('core.personAssignments')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={openCreateModal} size="sm"><Plus className="h-4 w-4 mr-1" />{t('core.newPersonAssignment')}</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-sm" />
          <Button onClick={handleSearch} variant="secondary" size="sm"><Search className="h-4 w-4" /></Button>
        </div>

        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading && <LoadingState />}

        {!loading && data.length === 0 && <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>}

        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">{t('core.personnel')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.department')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.jobTitle')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.assignmentType')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.leadershipLevel')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.effectiveFrom')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.effectiveTo')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{record.person?.name || record.personnelId}</td>
                    <td className="py-3 px-2">{record.department?.name || record.departmentId}</td>
                    <td className="py-3 px-2">{record.jobTitle?.name || '-'}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${record.assignmentType === 'PRIMARY' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {t(`core.assignmentTypes.${record.assignmentType}`)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {record.leadershipLevel && record.leadershipLevel !== 'NONE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {t(`core.leadershipLevels.${record.leadershipLevel}`)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs">{new Date(record.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-xs">{record.effectiveTo ? new Date(record.effectiveTo).toLocaleDateString() : '-'}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        <Button onClick={() => openTransferModal(record)} variant="ghost" size="sm" title="Transfer"><ArrowRightLeft className="h-4 w-4" /></Button>
                        <Button onClick={() => openEditModal(record)} variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                        <Button onClick={() => { setDeleteTarget(record.id); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && <div className="mt-4"><Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={(p) => fetchData(p, search)} /></div>}
      </Card>

      <Modal open={modalOpen} title={editingId ? t('core.editPersonAssignment') : t('core.newPersonAssignment')} onClose={() => { setModalOpen(false); setValidationErrors({}); }}>
        <div className="space-y-4">
          <F9Lookup
            label={t('core.personnel')}
            name="personnelId"
            value={form.personnelId}
            onChange={(v) => { setForm({ ...form, personnelId: v }); setValidationErrors(prev => ({ ...prev, personnelId: '' })); }}
            adapter={operationalPersonAdapter}
            error={validationErrors.personnelId}
          />
          <F9Lookup
            label={t('core.department')}
            name="departmentId"
            value={form.departmentId}
            onChange={(v) => { setForm({ ...form, departmentId: v }); setValidationErrors(prev => ({ ...prev, departmentId: '' })); }}
            adapter={departmentAdapter}
            error={validationErrors.departmentId}
          />
          <F9Lookup
            label={t('core.jobTitle')}
            name="jobTitleId"
            value={form.jobTitleId}
            onChange={(v) => { setForm({ ...form, jobTitleId: v }); setValidationErrors(prev => ({ ...prev, jobTitleId: '' })); }}
            adapter={jobTitleAdapter}
            error={validationErrors.jobTitleId}
          />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.assignmentType')}</label>
            <select value={form.assignmentType} onChange={(e) => setForm({ ...form, assignmentType: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {ASSIGNMENT_TYPES.map((type) => <option key={type} value={type}>{t(`core.assignmentTypes.${type}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.leadershipLevel')}</label>
            <select value={form.leadershipLevel} onChange={(e) => setForm({ ...form, leadershipLevel: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {LEADERSHIP_LEVELS.map((level) => <option key={level} value={level}>{t(`core.leadershipLevels.${level}`)}</option>)}
            </select>
            {['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'].includes(form.leadershipLevel) && (
              <p className="text-xs text-amber-600 mt-1">{t('core.leadershipDepartmentRequired')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('core.effectiveFrom')} *</label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} error={validationErrors.effectiveFrom} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('core.effectiveTo')}</label>
              <Input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={transferModal} title={t('core.transferPerson')} onClose={() => { setTransferModal(false); setTransferStep(1); setTransferPreview(null); setTransferResult(null); }}>
        <div className="space-y-4">
          {transferRecord && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{t('core.currentPlacement')}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('core.personnel')}</span>
                  <span className="text-sm font-medium">{transferRecord.person?.name || transferRecord.personnelId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('core.department')}</span>
                  <span className="text-sm font-medium">{transferRecord.department?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('core.jobTitle')}</span>
                  <span className="text-sm font-medium">{transferRecord.jobTitle?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('core.assignmentType')}</span>
                  <span className="text-sm font-medium">{t(`core.assignmentTypes.${transferRecord.assignmentType}`)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-1 justify-center text-xs">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`flex items-center gap-1 px-2 py-1 rounded ${transferStep >= step ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${transferStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{step}</span>
                <span>{t(`core.transferStep${step}`)}</span>
              </div>
            ))}
          </div>

          {transferStep === 1 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{t('core.transferNewPlacement')}</h3>
              <div className="space-y-4">
                <F9Lookup label={t('core.branch')} name="branchId" value={transferForm.branchId} onChange={(v) => setTransferForm({ ...transferForm, branchId: v, administrationId: '', departmentId: '' })} adapter={branchAdapter} />
                <F9Lookup label={t('core.administration')} name="administrationId" value={transferForm.administrationId} onChange={(v) => setTransferForm({ ...transferForm, administrationId: v, departmentId: '' })} adapter={administrationAdapter} filters={transferForm.branchId ? { branchId: transferForm.branchId } : undefined} />
                <F9Lookup label={t('core.department')} name="departmentId" value={transferForm.departmentId} onChange={(v) => setTransferForm({ ...transferForm, departmentId: v })} adapter={departmentAdapter} filters={{ ...(transferForm.branchId ? { branchId: transferForm.branchId } : {}), ...(transferForm.administrationId ? { administrationId: transferForm.administrationId } : {}) }} />
                <F9Lookup label={t('core.jobTitle')} name="jobTitleId" value={transferForm.jobTitleId} onChange={(v) => setTransferForm({ ...transferForm, jobTitleId: v })} adapter={jobTitleAdapter} />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.leadershipLevel')}</label>
                  <select value={transferForm.leadershipLevel} onChange={(e) => setTransferForm({ ...transferForm, leadershipLevel: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                    {LEADERSHIP_LEVELS.map((level) => <option key={level} value={level}>{t(`core.leadershipLevels.${level}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.effectiveFrom')} *</label>
                  <Input type="date" value={transferForm.effectiveFrom} onChange={(e) => setTransferForm({ ...transferForm, effectiveFrom: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
                  <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {transferStep === 2 && transferPreview && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('core.transferPreviewTitle')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-blue-600 font-medium">{t('core.oldPlacement')}</p>
                  <p className="text-sm font-semibold">{transferPreview.oldAssignment.department?.name || '-'}</p>
                  <p className="text-xs text-gray-500">{transferPreview.oldAssignment.jobTitle?.name || '-'}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-xs text-green-600 font-medium">{t('core.transferNewPlacement')}</p>
                  <p className="text-sm font-semibold">{transferPreview.proposedNewAssignment.departmentId}</p>
                  <p className="text-xs text-gray-500">{t('core.leadershipLevels.' + (transferPreview.proposedNewAssignment.leadershipLevel || 'NONE'))}</p>
                </div>
              </div>

              {transferPreview.summary.totalAffected > 0 ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-medium text-amber-800">{t('core.resolutionRequiredNotice', 'core', { count: transferPreview.summary.totalAffected })}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <span>{t('core.currentInbound')}: {transferPreview.summary.currentInbound}</span>
                      <span>{t('core.currentOutbound')}: {transferPreview.summary.currentOutbound}</span>
                      <span>{t('core.futureInbound')}: {transferPreview.summary.futureInbound + transferPreview.summary.futureOutbound}</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {transferPreview.affectedRelationships.filter(r => r.temporalCategory !== 'HISTORICAL').map((rel) => (
                      <div key={rel.id} className="border rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-medium">{rel.otherParty.person?.name || rel.otherParty.assignmentId}</p>
                            <p className="text-xs text-gray-500">{rel.otherParty.department?.name || '-'}</p>
                          </div>
                          <div className="flex gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${rel.direction === 'INBOUND' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{t(`core.directions.${rel.direction}`)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${rel.temporalCategory === 'CURRENT' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{t(`core.temporalCategories.${rel.temporalCategory}`)}</span>
                          </div>
                        </div>
                        {rel.allowedResolutions.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {rel.allowedResolutions.map((action) => (
                              <button key={action} onClick={() => setTransferResolutions(prev => ({ ...prev, [rel.id]: action }))}
                                className={`text-xs px-2 py-1 rounded border ${transferResolutions[rel.id] === action ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                                {t(`core.resolutionActions.${action}`)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{t('core.noAffectedRelationships')}</div>
              )}
            </div>
          )}

          {transferStep === 3 && transferPreview && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('core.confirmTransferTitle')}</h3>
              <p className="text-sm text-gray-600">{t('core.confirmTransferDescription')}</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" />{t('core.confirmTransferCloseOld')}</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" />{t('core.confirmTransferCreateNew')}</li>
                {transferPreview.summary.totalAffected > 0 && (
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full" />{t('core.confirmTransferReconcile', 'core', { count: transferPreview.summary.totalAffected })}</li>
                )}
              </ul>
              <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 space-y-1">
                <p><span className="font-medium">{t('core.transferDateLabel')}:</span> {transferForm.effectiveFrom}</p>
                <p><span className="font-medium">{t('core.leadershipLevel')}:</span> {t(`core.leadershipLevels.${transferForm.leadershipLevel}`)}</p>
                <p><span className="font-medium">{t('core.resolutionSummary')}:</span> {Object.values(transferResolutions).filter(a => a === 'END_AT_TRANSFER').length} {t('core.ended')}, {Object.values(transferResolutions).filter(a => a === 'CONTINUE_ON_NEW_ASSIGNMENT').length} {t('core.continued')}</p>
              </div>
            </div>
          )}

          {transferStep === 4 && transferResult && (
            <div className="border-t pt-4 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-medium text-lg">{t('core.transferSuccess')}</p>
                <p className="text-sm text-green-600 mt-2">{t('core.transferSuccessSummary', 'core', { ended: transferResult.relationshipsEnded, continued: transferResult.relationshipsContinued })}</p>
                <p className="text-xs text-gray-500 mt-2">ID: {transferResult.newAssignment?.id}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            {transferStep > 1 && transferStep < 4 ? (
              <Button variant="secondary" onClick={() => setTransferStep(transferStep === 3 ? 2 : 1)}>{t('core.transferBackToPreview')}</Button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setTransferModal(false); setTransferStep(1); setTransferPreview(null); setTransferResult(null); }}>
                {transferStep === 4 ? t('actions.close') : t('actions.cancel')}
              </Button>
              {transferStep === 1 && (
                <Button onClick={handlePreviewTransfer} loading={previewLoading} disabled={!transferForm.departmentId || !transferForm.effectiveFrom}>{t('core.transferStep2')}</Button>
              )}
              {transferStep === 2 && (
                <Button onClick={() => setTransferStep(3)}>{t('core.transferStep3')}</Button>
              )}
              {transferStep === 3 && (
                <Button onClick={handleApplyTransfer} loading={saving}>{t('core.applyTransfer')}</Button>
              )}
              {transferStep === 4 && (
                <Button onClick={() => { setTransferModal(false); setTransferStep(1); setTransferPreview(null); setTransferResult(null); fetchData(meta.page, search); }}>{t('actions.close')}</Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete} title={t('common.confirmDelete')} message={t('common.confirmDeleteMessage')} onConfirm={handleDelete} onClose={() => { setConfirmDelete(false); setDeleteTarget(null); }} />
    </div>
  );
}
