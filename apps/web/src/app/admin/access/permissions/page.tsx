'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { PageHeader, LoadingState, Pagination } from '../../../../components/admin/ui';
import { translatePermissionKey } from '../../../../lib/i18n/literals';

type PermissionRow = { id: string; key: string; description?: string | null; status?: string; isActive?: boolean; module?: string; action?: string };
type Tab = 'all' | 'active' | 'inactive';

const human = (value: string, isAr: boolean, kind: 'module' | 'action' = 'action') => {
  const locale = isAr ? 'ar' : 'en';
  const translated = translatePermissionKey(kind === 'module' ? value + ':read' : 'Permission:' + value, locale);
  const separator = translated.indexOf(' — ');
  return kind === 'module' ? (separator >= 0 ? translated.slice(0, separator) : translated) : (separator >= 0 ? translated.slice(separator + 3) : translated);
};
const splitKey = (key: string) => { const parts = key.split(/[.:/]/).filter(Boolean); const action = (parts.pop() || '').replace(/[_-]+/g, ' '); return { module: parts.join(' ').replace(/[_-]+/g, ' ').trim(), action }; };

export default function PermissionsPage() {
  const { locale } = useTranslation();
  const { showToast } = useToast();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });

  const fetchPermissions = useCallback(async (targetPage = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { page: targetPage, limit: 100 };
      if (search.trim()) params.search = search.trim();
      if (moduleFilter !== 'all') params.module = moduleFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      const response = await api.get<{ data: PermissionRow[]; meta: typeof meta }>('/permissions', { params });
      setRows(response.data || []); setMeta(response.meta || { page: targetPage, totalPages: 1, total: response.data?.length || 0 });
    } catch { setError(isAr ? 'تعذر تحميل الصلاحيات. حاول التحديث مرة أخرى.' : 'Unable to load permissions. Please refresh and try again.'); }
    finally { setLoading(false); }
  }, [page, search, moduleFilter, actionFilter, isAr]);
  useEffect(() => { fetchPermissions(1); }, [search, moduleFilter, actionFilter]);
  useEffect(() => { fetchPermissions(page); }, [page]);

  const enriched = useMemo(() => rows.map((row) => { const parsed = splitKey(row.key || ''); const active = row.isActive ?? String(row.status || '').toUpperCase() !== 'INACTIVE'; return { ...row, ...parsed, active }; }), [rows]);
  const filtered = useMemo(() => enriched.filter((row) => tab === 'all' || (tab === 'active' ? row.active : !row.active)), [enriched, tab]);
  const modules = useMemo(() => Array.from(new Set(enriched.map((r) => r.module))).filter(Boolean).sort(), [enriched]);
  const actions = useMemo(() => Array.from(new Set(enriched.map((r) => r.action))).filter(Boolean).sort(), [enriched]);
  const groups = useMemo(() => modules.map((module) => ({ module, count: filtered.filter((r) => r.module === module).length })).filter((x) => x.count > 0), [modules, filtered]);
  const totalActive = enriched.filter((r) => r.active).length;
  const clearFilters = () => { setSearch(''); setModuleFilter('all'); setActionFilter('all'); setTab('all'); setPage(1); };

  return <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
    <PageHeader title={isAr ? 'إدارة الصلاحيات' : 'Permissions Management'} />
    <div className="grid gap-3 sm:grid-cols-3"><Stat label={isAr ? 'إجمالي الصلاحيات' : 'Total Permissions'} value={meta.total || rows.length} /><Stat label={isAr ? 'النشطة في الصفحة' : 'Active on page'} value={totalActive} tone="green" /><Stat label={isAr ? 'الوحدات الظاهرة' : 'Visible Modules'} value={groups.length} tone="blue" /></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{isAr ? 'دليل الصلاحيات' : 'Permission Directory'}</h2><p className="mt-1 text-xs text-slate-600">{isAr ? 'استخدم التبويبات والفلاتر للوصول إلى المطلوب بسرعة.' : 'Use tabs and filters to find the required permission quickly.'}</p></div><button type="button" onClick={() => fetchPermissions(page)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{isAr ? 'تحديث' : 'Refresh'}</button></div>
        <div className="mt-4 flex flex-wrap gap-2">{([['all', isAr ? 'الكل' : 'All'], ['active', isAr ? 'النشطة' : 'Active'], ['inactive', isAr ? 'غير النشطة' : 'Inactive']] as [Tab, string][]).map(([value, text]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === value ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{text}</button>)}</div>
      </div>
      <div className="space-y-3 border-b border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_190px_auto]"><label className="sr-only" htmlFor="permission-search">{isAr ? 'بحث' : 'Search'}</label><input id="permission-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={isAr ? 'ابحث باسم الصلاحية أو الوحدة أو الإجراء…' : 'Search permission, module, or action…'} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /><select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">{isAr ? 'كل الوحدات' : 'All modules'}</option>{modules.map((m) => <option key={m} value={m}>{human(m, isAr, 'module')}</option>)}</select><select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">{isAr ? 'كل الإجراءات' : 'All actions'}</option>{actions.map((a) => <option key={a} value={a}>{human(a, isAr)}</option>)}</select><button type="button" onClick={clearFilters} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">{isAr ? 'مسح الفلاتر' : 'Clear filters'}</button></div><div className="flex flex-wrap gap-2">{groups.map((group) => <button type="button" key={human(group.module, isAr, 'module')} onClick={() => { setModuleFilter(group.module); setPage(1); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${moduleFilter === group.module ? 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{human(group.module, isAr, 'module')} <span className="opacity-70">({group.count})</span></button>)}</div></div>
      {loading && <LoadingState />}
      {!loading && error && <div className="p-8 text-center text-sm text-red-600">{error}</div>}
      {!loading && !error && filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500">{isAr ? 'لا توجد صلاحيات مطابقة للفلاتر الحالية.' : 'No permissions match the current filters.'}</div>}
      {!loading && !error && filtered.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-start text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-start">{isAr ? 'الصلاحية' : 'Permission'}</th><th className="px-4 py-3 text-start">{isAr ? 'الوحدة' : 'Module'}</th><th className="px-4 py-3 text-start">{isAr ? 'الإجراء' : 'Action'}</th><th className="px-4 py-3 text-start">{isAr ? 'الوصف' : 'Description'}</th><th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.id} className="hover:bg-sky-50/40"><td className="px-4 py-3 font-semibold text-slate-900">{translatePermissionKey(row.key, locale)}</td><td className="px-4 py-3 text-slate-600">{human(row.module, isAr, 'module')}</td><td className="px-4 py-3 text-slate-600">{human(row.action, isAr, 'action')}</td><td className="max-w-[300px] px-4 py-3 text-slate-500">{row.description || (isAr ? 'غير متوفر' : 'Not available')}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.active ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'غير نشطة' : 'Inactive')}</span></td></tr>)}</tbody></table></div>}
      {!loading && !error && <div className="border-t border-slate-200 p-4"><Pagination page={meta.page || page} totalPages={meta.totalPages || 1} total={meta.total || filtered.length} onPageChange={(next) => { setPage(next); fetchPermissions(next); }} /></div>}
    </section>
  </div>;
}
function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className={`mt-2 text-2xl font-black ${tone === 'green' ? 'text-emerald-700' : tone === 'blue' ? 'text-blue-700' : 'text-slate-900'}`}>{value}</div></div>; }
