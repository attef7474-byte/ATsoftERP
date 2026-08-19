'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { SupervisorAssignment, PaginationMeta } from '@/lib/admin-types';
import { Button, Input, Card, LoadingState, Modal, StatusBadge, Pagination, ConfirmDialog } from '@/components/admin/ui';
import { F9Lookup, personAssignmentAdapter } from '@/components/f9';
import { Search, Plus, Trash2, RefreshCw, UserCheck } from 'lucide-react';

interface SupervisorForm {
  assignmentId: string;
  supervisorAssignmentId: string;
  relationshipType: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const EMPTY_FORM: SupervisorForm = { assignmentId: '', supervisorAssignmentId: '', relationshipType: 'DIRECT', effectiveFrom: '', effectiveTo: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };
const RELATIONSHIP_TYPES = ['DIRECT', 'MATRIX', 'FUNCTIONAL'];

export default function SupervisorAssignmentsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<SupervisorAssignment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SupervisorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/supervisor-assignments', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
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
    setForm(EMPTY_FORM);
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const fieldErrors: Record<string, string> = {};
    if (!form.assignmentId) fieldErrors.assignmentId = t('validation.required');
    if (!form.effectiveFrom) fieldErrors.effectiveFrom = t('validation.required');
    if (Object.keys(fieldErrors).length > 0) {
      setValidationErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        assignmentId: form.assignmentId,
        supervisorAssignmentId: form.supervisorAssignmentId || null,
        relationshipType: form.relationshipType,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      await api.post('/supervisor-assignments', payload);
      showToast(t('common.successCreated'), 'success');
      setModalOpen(false);
      fetchData(meta.page, search);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/supervisor-assignments/${deleteTarget}`);
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
            <UserCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('core.supervisorAssignments')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={openCreateModal} size="sm"><Plus className="h-4 w-4 mr-1" />{t('core.newSupervisorAssignment')}</Button>
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
                  <th className="text-left py-3 px-2 font-medium">{t('core.personnel')} (Subordinate)</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.personnel')} (Supervisor)</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.relationshipType')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.effectiveFrom')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.status')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{record.assignment?.person?.name || record.assignmentId}</td>
                    <td className="py-3 px-2">{record.supervisorAssignment?.person?.name || record.supervisorAssignmentId || '-'}</td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {t(`core.relationshipTypes.${record.relationshipType}`)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs">{new Date(record.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-3 px-2"><StatusBadge status={record.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="py-3 px-2">
                      <Button onClick={() => { setDeleteTarget(record.id); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && <div className="mt-4"><Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={(p) => fetchData(p, search)} /></div>}
      </Card>

      <Modal open={modalOpen} title={t('core.newSupervisorAssignment')} onClose={() => { setModalOpen(false); setValidationErrors({}); }}>
        <div className="space-y-4">
          <F9Lookup
            label={`${t('core.personnel')} (Subordinate Assignment)`}
            name="assignmentId"
            value={form.assignmentId}
            onChange={(v) => { setForm({ ...form, assignmentId: v }); setValidationErrors(prev => ({ ...prev, assignmentId: '' })); }}
            adapter={personAssignmentAdapter}
            error={validationErrors.assignmentId}
          />
          <F9Lookup
            label={`${t('core.personnel')} (Supervisor Assignment)`}
            name="supervisorAssignmentId"
            value={form.supervisorAssignmentId}
            onChange={(v) => { setForm({ ...form, supervisorAssignmentId: v }); setValidationErrors(prev => ({ ...prev, supervisorAssignmentId: '' })); }}
            adapter={personAssignmentAdapter}
            error={validationErrors.supervisorAssignmentId}
          />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.relationshipType')}</label>
            <select value={form.relationshipType} onChange={(e) => setForm({ ...form, relationshipType: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{t(`core.relationshipTypes.${type}`)}</option>)}
            </select>
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
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete} title={t('common.confirmDelete')} message={t('common.confirmDeleteMessage')} onConfirm={handleDelete} onClose={() => { setConfirmDelete(false); setDeleteTarget(null); }} />
    </div>
  );
}
