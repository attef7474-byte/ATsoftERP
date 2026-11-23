'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { Button, Input, Card, LoadingState, Modal, StatusBadge, Pagination, ConfirmDialog } from '@/components/admin/ui';
import { Search, Plus, Edit, RefreshCw, Shield, Link2, Power, PowerOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const CATEGORIES = ['MAINTENANCE','PRODUCTION','WAREHOUSE','QUALITY','PLANNING','SUPERVISION','GENERAL'];
const TARGET_TYPES = ['JOB_TITLE','MAINTENANCE_ROLE','OPERATIONAL_CATEGORY'];

const emptyProfile = { code: '', name: '', nameAr: '', nameEn: '', description: '', category: 'GENERAL', isActive: true };
const emptyMapping = { performanceProfileId: '', targetType: 'JOB_TITLE', jobTitleId: '', targetCode: '', priority: 100, effectiveFrom: '', effectiveTo: '', isActive: true, notes: '' };

export default function PerformanceProfilesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { permissions, isSuperAdmin } = useAuth();
  const can = useCallback((p: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(p)), [isSuperAdmin, permissions]);
  const canCreate = can('performance-profile:create');
  const canUpdate = can('performance-profile:update');
  const canDeactivate = can('performance-profile:deactivate');
  const canMapCreate = can('performance-profile-mapping:create');
  const canMapUpdate = can('performance-profile-mapping:update');
  const canMapDeactivate = can('performance-profile-mapping:deactivate');

  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<any>(emptyMapping);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<Record<string,string>>({});
  const [jobTitles, setJobTitles] = useState<any[]>([]);

  const fetchData = useCallback(async (page = 1, q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/performance/profiles', { params: { page, limit: 20, search: q || undefined } }) as any;
      setData(res.data || []);
      setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
      if (selected) {
        const fresh = (res.data || []).find((x: any) => x.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error');
    } finally { setLoading(false); }
  }, [selected, showToast, t]);

  const fetchJobTitles = useCallback(async () => {
    try {
      const res = await api.get('/job-titles', { params: { page: 1, limit: 200, isActive: 'true' } }) as any;
      setJobTitles(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(1, ''); fetchJobTitles(); }, []); // eslint-disable-line

  const openCreate = () => { setEditingId(null); setForm(emptyProfile); setErrors({}); setModalOpen(true); };
  const openEdit = (p: any) => { setEditingId(p.id); setForm({ code: p.code, name: p.name, nameAr: p.nameAr || '', nameEn: p.nameEn || '', description: p.description || '', category: p.category || 'GENERAL', isActive: !!p.isActive }); setErrors({}); setModalOpen(true); };

  const saveProfile = async () => {
    const e: Record<string,string> = {};
    if (!form.code?.trim()) e.code = t('validation.required');
    if (!form.name?.trim()) e.name = t('validation.required');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (editingId) await api.patch(`/performance/profiles/${editingId}`, form);
      else await api.post('/performance/profiles', form);
      showToast(editingId ? t('common.successUpdated') : t('common.successCreated'), 'success');
      setModalOpen(false);
      await fetchData(meta.page, search);
    } catch (err: any) {
      const fe = err?.response?.data?.errors;
      if (fe?.length) { const m: any = {}; fe.forEach((x: any) => m[x.field] = x.message); setErrors(m); }
      else showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally { setSaving(false); }
  };

  const toggleProfile = async (p: any) => {
    try {
      const path = p.isActive ? 'deactivate' : 'activate';
      await api.post(`/performance/profiles/${p.id}/${path}`, {});
      showToast(t('common.successUpdated'), 'success');
      await fetchData(meta.page, search);
    } catch (err: any) { showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error'); }
  };

  const openAddMapping = (profile: any) => {
    setEditingMappingId(null);
    setMappingForm({ ...emptyMapping, performanceProfileId: profile.id, effectiveFrom: new Date().toISOString().slice(0,10) });
    setMappingErrors({});
    setMappingModalOpen(true);
  };
  const openEditMapping = (profile: any, m: any) => {
    setEditingMappingId(m.id);
    setMappingForm({ performanceProfileId: profile.id, targetType: m.targetType, jobTitleId: m.jobTitleId || '', targetCode: m.targetCode || '', priority: m.priority ?? 100, effectiveFrom: m.effectiveFrom ? String(m.effectiveFrom).slice(0,10) : '', effectiveTo: m.effectiveTo ? String(m.effectiveTo).slice(0,10) : '', isActive: !!m.isActive, notes: m.notes || '' });
    setMappingErrors({});
    setMappingModalOpen(true);
  };

  const saveMapping = async () => {
    const e: Record<string,string> = {};
    if (!mappingForm.performanceProfileId) e.performanceProfileId = t('validation.required');
    if (!mappingForm.targetType) e.targetType = t('validation.required');
    if (mappingForm.targetType === 'JOB_TITLE' && !mappingForm.jobTitleId) e.jobTitleId = t('validation.required');
    if (mappingForm.targetType !== 'JOB_TITLE' && !mappingForm.targetCode?.trim()) e.targetCode = t('validation.required');
    if (!mappingForm.effectiveFrom) e.effectiveFrom = t('validation.required');
    setMappingErrors(e);
    if (Object.keys(e).length) return;
    setMappingSaving(true);
    try {
      const payload: any = { ...mappingForm, priority: Number(mappingForm.priority || 100), effectiveTo: mappingForm.effectiveTo || null };
      if (payload.targetType === 'JOB_TITLE') { payload.targetCode = null; } else { payload.jobTitleId = null; }
      if (editingMappingId) await api.patch(`/performance/profile-mappings/${editingMappingId}`, payload);
      else await api.post('/performance/profile-mappings', payload);
      showToast(editingMappingId ? t('common.successUpdated') : t('common.successCreated'), 'success');
      setMappingModalOpen(false);
      if (selected) await selectProfile(selected.id);
      await fetchData(meta.page, search);
    } catch (err: any) {
      const fe = err?.response?.data?.errors;
      if (fe?.length) { const m: any = {}; fe.forEach((x: any) => m[x.field] = x.message); setMappingErrors(m); }
      else showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally { setMappingSaving(false); }
  };

  const toggleMapping = async (m: any) => {
    try {
      const path = m.isActive ? 'deactivate' : 'activate';
      await api.post(`/performance/profile-mappings/${m.id}/${path}`, {});
      showToast(t('common.successUpdated'), 'success');
      if (selected) await selectProfile(selected.id);
      await fetchData(meta.page, search);
    } catch (err: any) { showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error'); }
  };

  const selectProfile = async (id: string) => {
    try {
      const res = await api.get(`/performance/profiles/${id}`) as any;
      setSelected(res);
    } catch (err: any) { showToast(err?.response?.data?.message || t('errors.loadFailed'), 'error'); }
  };

  const labelCat = (c: string) => t(`core.performance.category_${c}`) || c;
  const labelTarget = (c: string) => t(`core.performance.targetType_${c}`) || c;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><Shield className="h-6 w-6 text-blue-600" /><h1 className="text-2xl font-bold">{t('core.performance.profiles')}</h1></div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
            {canCreate && <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />{t('core.performance.createProfile')}</Button>}
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e: any) => setSearch(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && fetchData(1, search)} />
          <Button onClick={() => fetchData(1, search)} variant="secondary"><Search className="h-4 w-4" /></Button>
        </div>
        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2 px-2">{t('core.performance.code')}</th><th className="py-2 px-2">{t('core.performance.name')}</th><th className="py-2 px-2">{t('core.performance.category')}</th><th className="py-2 px-2">{t('core.performance.mappingCount')}</th><th className="py-2 px-2">{t('common.status')}</th><th className="py-2 px-2">{t('common.actions')}</th></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className={`border-b hover:bg-gray-50 cursor-pointer ${selected?.id === p.id ? 'bg-blue-50' : ''}`} onClick={() => selectProfile(p.id)}>
                    <td className="py-2 px-2 font-mono">{p.code}</td>
                    <td className="py-2 px-2">{p.nameAr || p.name}{p.nameEn ? <span className="text-gray-400 text-xs ms-2">{p.nameEn}</span> : null}</td>
                    <td className="py-2 px-2">{labelCat(p.category)}</td>
                    <td className="py-2 px-2">{p._count?.mappings ?? 0}</td>
                    <td className="py-2 px-2"><StatusBadge status={p.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {canUpdate && <Button size="sm" variant="secondary" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>}
                        {canDeactivate && <Button size="sm" variant="secondary" onClick={() => toggleProfile(p)}>{p.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={(page) => fetchData(page, search)} />
      </Card>

      {selected && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-lg font-semibold">{t('core.performance.profileDetails')}: {selected.code}</h2><p className="text-sm text-gray-500">{selected.description || ''}</p></div>
            {canMapCreate && <Button size="sm" onClick={() => openAddMapping(selected)}><Link2 className="h-4 w-4 mr-1" />{t('core.performance.addMapping')}</Button>}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2 px-2">{t('core.performance.targetType')}</th><th className="py-2 px-2">{t('core.performance.target')}</th><th className="py-2 px-2">{t('core.performance.priority')}</th><th className="py-2 px-2">{t('core.performance.effectiveFrom')}</th><th className="py-2 px-2">{t('core.performance.effectiveTo')}</th><th className="py-2 px-2">{t('common.status')}</th><th className="py-2 px-2">{t('common.actions')}</th></tr></thead>
              <tbody>
                {(selected.mappings || []).map((m: any) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 px-2">{labelTarget(m.targetType)}</td>
                    <td className="py-2 px-2">{m.targetType === 'JOB_TITLE' ? (m.jobTitle?.nameAr || m.jobTitle?.name || m.jobTitleId) : m.targetCode}</td>
                    <td className="py-2 px-2">{m.priority}</td>
                    <td className="py-2 px-2">{String(m.effectiveFrom).slice(0,10)}</td>
                    <td className="py-2 px-2">{m.effectiveTo ? String(m.effectiveTo).slice(0,10) : t('core.performance.openEnded')}</td>
                    <td className="py-2 px-2"><StatusBadge status={m.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        {canMapUpdate && <Button size="sm" variant="secondary" onClick={() => openEditMapping(selected, m)}><Edit className="h-4 w-4" /></Button>}
                        {canMapDeactivate && <Button size="sm" variant="secondary" onClick={() => toggleMapping(m)}>{m.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!selected.mappings || selected.mappings.length === 0) && <tr><td colSpan={7} className="py-4 text-center text-gray-500">{t('core.performance.noMappings')}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('core.performance.editProfile') : t('core.performance.createProfile')}>
        <div className="space-y-3">
          <Input label={t('core.performance.code')} value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} error={errors.code} />
          <Input label={t('core.performance.name')} value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label={t('core.performance.nameAr')} value={form.nameAr} onChange={(e: any) => setForm({ ...form, nameAr: e.target.value })} />
          <Input label={t('core.performance.nameEn')} value={form.nameEn} onChange={(e: any) => setForm({ ...form, nameEn: e.target.value })} />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.performance.category')}</label>
            <select className="w-full border rounded px-3 py-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{labelCat(c)}</option>)}
            </select>
          </div>
          <Input label={t('core.performance.description')} value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />{t('core.performance.isActive')}</label>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={saveProfile} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button></div>
        </div>
      </Modal>

      <Modal open={mappingModalOpen} onClose={() => setMappingModalOpen(false)} title={editingMappingId ? t('core.performance.editMapping') : t('core.performance.addMapping')}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.performance.targetType')}</label>
            <select className="w-full border rounded px-3 py-2" value={mappingForm.targetType} onChange={(e) => setMappingForm({ ...mappingForm, targetType: e.target.value })}>
              {TARGET_TYPES.map((c) => <option key={c} value={c}>{labelTarget(c)}</option>)}
            </select>
          </div>
          {mappingForm.targetType === 'JOB_TITLE' ? (
            <div>
              <label className="block text-sm font-medium mb-1">{t('core.performance.jobTitle')}</label>
              <select className="w-full border rounded px-3 py-2" value={mappingForm.jobTitleId} onChange={(e) => setMappingForm({ ...mappingForm, jobTitleId: e.target.value })}>
                <option value="">--</option>
                {jobTitles.map((jt: any) => <option key={jt.id} value={jt.id}>{jt.code} - {jt.nameAr || jt.name}</option>)}
              </select>
              {mappingErrors.jobTitleId && <p className="text-red-600 text-xs mt-1">{mappingErrors.jobTitleId}</p>}
            </div>
          ) : (
            <Input label={t('core.performance.target')} value={mappingForm.targetCode} onChange={(e: any) => setMappingForm({ ...mappingForm, targetCode: e.target.value })} error={mappingErrors.targetCode} />
          )}
          <Input label={t('core.performance.priority')} type="number" value={mappingForm.priority} onChange={(e: any) => setMappingForm({ ...mappingForm, priority: e.target.value })} />
          <Input label={t('core.performance.effectiveFrom')} type="date" value={mappingForm.effectiveFrom} onChange={(e: any) => setMappingForm({ ...mappingForm, effectiveFrom: e.target.value })} error={mappingErrors.effectiveFrom} />
          <Input label={t('core.performance.effectiveTo')} type="date" value={mappingForm.effectiveTo} onChange={(e: any) => setMappingForm({ ...mappingForm, effectiveTo: e.target.value })} />
          <Input label={t('core.performance.notes')} value={mappingForm.notes} onChange={(e: any) => setMappingForm({ ...mappingForm, notes: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!mappingForm.isActive} onChange={(e) => setMappingForm({ ...mappingForm, isActive: e.target.checked })} />{t('core.performance.isActive')}</label>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setMappingModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={saveMapping} disabled={mappingSaving}>{mappingSaving ? t('common.saving') : t('common.save')}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
