'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { Button, Card, Input, LoadingState } from '@/components/admin/ui';
import { RefreshCw, ShieldCheck } from 'lucide-react';

export default function PerformanceKpiCoveragePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [period, setPeriod] = useState({ from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });

  const L = (k: string, f: string) => t(k) || f;
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/performance/kpis/coverage', { params: { dateFrom: new Date(period.from).toISOString(), dateTo: new Date(period.to + 'T23:59:59.999Z').toISOString() } }) as any;
      setItems(res.items || []);
    } catch (e: any) { showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error'); }
    finally { setLoading(false); }
  }, [period.from, period.to, showToast, t]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-blue-600" /><div><h1 className="text-2xl font-bold">{L('core.performance.kpiCoverage', 'KPI Data Quality')}</h1><p className="text-sm text-gray-500">{L('core.performance.noScore', 'Raw metric only. No score/weight/ranking in Phase 2.')}</p></div></div>
          <Button variant="secondary" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Input label={L('core.performance.dateFrom', 'From')} type="date" value={period.from} onChange={(e: any) => setPeriod({ ...period, from: e.target.value })} />
          <Input label={L('core.performance.dateTo', 'To')} type="date" value={period.to} onChange={(e: any) => setPeriod({ ...period, to: e.target.value })} />
          <div className="flex items-end"><Button onClick={fetchData}>{L('common.apply', 'Apply')}</Button></div>
        </div>
        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b text-left">
                <th className="py-2 px-2">{L('core.performance.kpiCode', 'Code')}</th>
                <th className="py-2 px-2">{L('core.performance.kpiName', 'Name')}</th>
                <th className="py-2 px-2">{L('core.performance.eligibleProfiles', 'Eligible Profiles')}</th>
                <th className="py-2 px-2">{L('core.performance.eligibleEmployees', 'Eligible (sample)')}</th>
                <th className="py-2 px-2">{L('core.performance.calculable', 'Calculable')}</th>
                <th className="py-2 px-2">{L('core.performance.insufficientData', 'Insufficient')}</th>
                <th className="py-2 px-2">{L('core.performance.notApplicable', 'Not Applicable')}</th>
                <th className="py-2 px-2">{L('core.performance.attributionGaps', 'Attribution Gaps')}</th>
              </tr></thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.kpi.id} className="border-b">
                    <td className="py-2 px-2 font-mono">{item.kpi.code}</td>
                    <td className="py-2 px-2">{item.kpi.nameAr || item.kpi.name}</td>
                    <td className="py-2 px-2">{(item.eligibleProfiles || []).map((p: any) => p.code).join(', ') || '-'}</td>
                    <td className="py-2 px-2">{item.eligibleEmployeesSampled}</td>
                    <td className="py-2 px-2 text-green-700">{item.calculable}</td>
                    <td className="py-2 px-2 text-amber-700">{item.insufficientData}</td>
                    <td className="py-2 px-2">{item.notApplicable}</td>
                    <td className="py-2 px-2 text-red-700">{item.attributionAmbiguous}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
