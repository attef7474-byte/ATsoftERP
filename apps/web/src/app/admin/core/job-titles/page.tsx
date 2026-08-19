'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { JobTitle, PaginationMeta } from '@/lib/admin-types';
import { Button } from '@/components/admin/ui';
import { Input } from '@/components/admin/ui';
import { Card } from '@/components/admin/ui';
import { LoadingState } from '@/components/admin/ui';
import { Modal } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/ui';
import { Pagination } from '@/components/admin/ui';
import { ConfirmDialog } from '@/components/admin/ui';
import { Search, Plus, Edit, Trash2, RefreshCw, Briefcase } from 'lucide-react';

interface JobTitleForm {
  code: string;
  name: string;
  nameAr: string;
  nameEn: string;
  category: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: JobTitleForm = { code: '', name: '', nameAr: '', nameEn: '', category: 'OPERATIONAL', description: '', isActive: true };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const CATEGORY_OPTIONS = ['OPERATIONAL', 'MANAGEMENT', 'TECHNICAL', 'SUPPORT'];

export default function JobTitlesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<JobTitle[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobTitleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/job-titles', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
      setData(res.data);
      setMeta(res.meta);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(meta.page, search); }, []);

  const handleSearch = () => { fetchData(1, search); };

  const handlePageChange = (page: number) => { fetchData(page, search); };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEditModal = (record: JobTitle) => {
    setEditingId(record.id);
    setForm({
      code: record.code,
      name: record.name,
      nameAr: record.nameAr || '',
      nameEn: record.nameEn || '',
      category: record.category || 'OPERATIONAL',
      description: record.description || '',
      isActive: record.isActive,
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = t('validation.required');
    if (!form.name.trim()) errors.name = t('validation.required');
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/job-titles/${editingId}`, form);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/job-titles', form);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page, search);
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors;
      if (fieldErrors?.length) {
        const mapped: Record<string, string> = {};
        fieldErrors.forEach((e: any) => { mapped[e.field] = e.message; });
        setValidationErrors(mapped);
      } else {
        showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/job-titles/${deleteTarget}`);
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
            <Briefcase className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('core.jobTitles')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
            </Button>
            <Button onClick={openCreateModal} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t('core.newJobTitle')}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder={t('grid.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-sm"
          />
          <Button onClick={handleSearch} variant="secondary" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading && <LoadingState />}

        {!loading && data.length === 0 && (
          <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>
        )}

        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">{t('common.code')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.name')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.jobTitleCategory')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.status')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2 font-mono text-xs">{record.code}</td>
                    <td className="py-3 px-2">{record.name}</td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {t(`core.jobTitleCategories.${record.category}`)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <StatusBadge status={record.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        <Button onClick={() => router.push(`/admin/core/job-titles/${record.id}`)} variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => { setDeleteTarget(record.id); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="mt-4">
            <Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </Card>

      <Modal open={modalOpen} title={editingId ? t('core.editJobTitle') : t('core.newJobTitle')} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.code')} *</label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            {validationErrors.code && <p className="text-red-500 text-xs mt-1">{validationErrors.code}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.name')} *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.nameAr')}</label>
              <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.nameEn')}</label>
              <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.jobTitleCategory')}</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{t(`core.jobTitleCategories.${cat}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : t('actions.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={t('common.confirmDelete')}
        message={t('common.confirmDeleteMessage')}
        onConfirm={handleDelete}
        onClose={() => { setConfirmDelete(false); setDeleteTarget(null); }}
      />
    </div>
  );
}
