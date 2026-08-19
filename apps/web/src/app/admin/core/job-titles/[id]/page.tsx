'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { JobTitle } from '@/lib/admin-types';
import { Button } from '@/components/admin/ui';
import { Card } from '@/components/admin/ui';
import { LoadingState } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/ui';
import { Modal } from '@/components/admin/ui';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

export default function JobTitleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [data, setData] = useState<JobTitle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', nameEn: '', category: 'OPERATIONAL', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/job-titles/${id}`) as any;
      setData(res);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = () => {
    if (!data) return;
    setForm({
      code: data.code,
      name: data.name,
      nameAr: data.nameAr || '',
      nameEn: data.nameEn || '',
      category: data.category || 'OPERATIONAL',
      description: data.description || '',
    });
    setEditModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/job-titles/${id}`, form);
      showToast(t('common.successUpdated'), 'success');
      setEditModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/job-titles/${id}`);
      showToast(t('common.successDeleted'), 'success');
      router.push('/admin/core/job-titles');
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.deleteFailed'), 'error');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!data) return <div className="p-4">{t('common.notFound')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={() => router.push('/admin/core/job-titles')} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <StatusBadge status={data.isActive ? 'ACTIVE' : 'INACTIVE'} />
      </div>

      <Card>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">{t('details.overview')}</h2>
          <div className="flex gap-2">
            <Button onClick={handleEdit} variant="secondary" size="sm"><Edit className="h-4 w-4 mr-1" />{t('actions.edit')}</Button>
            <Button onClick={handleDelete} variant="secondary" size="sm" className="text-red-600"><Trash2 className="h-4 w-4 mr-1" />{t('actions.delete')}</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">{t('common.code')}:</span> <span className="font-mono">{data.code}</span></div>
          <div><span className="text-gray-500">{t('common.name')}:</span> {data.name}</div>
          <div><span className="text-gray-500">{t('core.jobTitleCategory')}:</span> {t(`core.jobTitleCategories.${data.category}`)}</div>
          {data.nameAr && <div><span className="text-gray-500">{t('common.nameAr')}:</span> {data.nameAr}</div>}
          {data.nameEn && <div><span className="text-gray-500">{t('common.nameEn')}:</span> {data.nameEn}</div>}
          {data.description && <div className="col-span-2"><span className="text-gray-500">{t('common.description')}:</span> {data.description}</div>}
          <div><span className="text-gray-500">{t('common.company')}:</span> {data.company?.name}</div>
          <div><span className="text-gray-500">{t('common.createdAt')}:</span> {new Date(data.createdAt).toLocaleDateString()}</div>
          <div><span className="text-gray-500">{t('common.updatedAt')}:</span> {new Date(data.updatedAt).toLocaleDateString()}</div>
        </div>
      </Card>

      {data._count && (
        <Card>
          <h2 className="text-lg font-semibold mb-2">{t('details.relatedRecords')}</h2>
          <p className="text-sm text-gray-600">{t('core.personAssignments')}: {data._count.assignments}</p>
        </Card>
      )}

      <Modal open={editModal} title={t('core.editJobTitle')} onClose={() => setEditModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.code')}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.name')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.nameAr')}</label>
              <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" dir="rtl" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.nameEn')}</label>
              <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.jobTitleCategory')}</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              <option value="OPERATIONAL">{t('core.jobTitleCategories.OPERATIONAL')}</option>
              <option value="MANAGEMENT">{t('core.jobTitleCategories.MANAGEMENT')}</option>
              <option value="TECHNICAL">{t('core.jobTitleCategories.TECHNICAL')}</option>
              <option value="SUPPORT">{t('core.jobTitleCategories.SUPPORT')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setEditModal(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.loading') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
