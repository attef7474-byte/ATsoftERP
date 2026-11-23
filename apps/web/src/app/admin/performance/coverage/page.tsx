'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { Button, Card, LoadingState, Input, Pagination } from '@/components/admin/ui';
import { RefreshCw, BarChart3, Search } from 'lucide-react';

export default function PerformanceCoveragePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [hasProfile, setHasProfile] = useState('');

  const fetchAll = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api.get('/performance/coverage') as Promise<any>,
        api.get('/performance/coverage/employees', { params: { page, limit: 20, search: search || undefined, hasProfile: hasProfile || undefined } }) as Promise<any>,
      ]);
      setSummary(s);
      setRows(list.data || []);
      setMeta(list.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e: any) {
      showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error');
    } finally { setLoading(false); }
  }, [search, hasProfile, showToast, t]);

  useEffect(() => { fetchAll(1); }, []); // eslint-disable-line

  const stat = (label: string, value: number | undefined) => (
    <div className="border rounded p-4"><div className="text-sm text-gray-500">{label}</div><div className="text-2xl font-bold">{value ?? 0}</div></div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-blue-600" /><h1 className="text-2xl font-bold">{t('core.performance.coverage')}</h1></div>
          <Button onClick={() => fetchAll(meta.page)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {loading && !summary ? <LoadingState /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stat(t('core.performance.activeEmployees'), summary?.activeEmployees)}
            {stat(t('core.performance.withCurrentAssignment'), summary?.withCurrentAssignment)}
            {stat(t('core.performance.withoutCurrentAssignment'), summary?.withoutCurrentAssignment)}
            {stat(t('core.performance.withJobTitle'), summary?.withJobTitle)}
            {stat(t('core.performance.withoutJobTitle'), summary?.withoutJobTitle)}
            {stat(t('core.performance.withSupervisor'), summary?.withSupervisor)}
            {stat(t('core.performance.withoutSupervisor'), summary?.withoutSupervisor)}
            {stat(t('core.performance.withProfile'), summary?.withPerformanceProfile)}
            {stat(t('core.performance.withoutProfile'), summary?.withoutPerformanceProfile)}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">{t('core.performance.coverageList')}</h2>
        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e: any) => setSearch(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && fetchAll(1)} />
          <select className="border rounded px-3 py-2" value={hasProfile} onChange={(e) => setHasProfile(e.target.value)}>
            <option value="">{t('core.performance.all')}</option>
            <option value="true">{t('core.performance.withProfile')}</option>
            <option value="false">{t('core.performance.withoutProfile')}</option>
          </select>
          <Button onClick={() => fetchAll(1)} variant="secondary"><Search className="h-4 w-4" /></Button>
        </div>
        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2 px-2">{t('core.performance.employee')}</th><th className="py-2 px-2">{t('core.performance.department')}</th><th className="py-2 px-2">{t('core.performance.jobTitle')}</th><th className="py-2 px-2">{t('core.performance.supervisor')}</th><th className="py-2 px-2">{t('core.performance.currentProfile')}</th></tr></thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.employee.id} className="border-b">
                    <td className="py-2 px-2">{r.employee.code} - {r.employee.name}</td>
                    <td className="py-2 px-2">{r.department?.name || '-'}</td>
                    <td className="py-2 px-2">{r.jobTitle?.nameAr || r.jobTitle?.name || '-'}</td>
                    <td className="py-2 px-2">{r.supervisor?.name || '-'}</td>
                    <td className="py-2 px-2">{r.performanceProfile ? (r.performanceProfile.nameAr || r.performanceProfile.name) : <span className="text-amber-600">{t('core.performance.unassigned')}</span>}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={(p) => fetchAll(p)} />
      </Card>
    </div>
  );
}
