'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Card, CardContent, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { ReportSummaryCards } from '../../../../components/reports';

const TABS = ['dashboard', 'stockCard', 'movements', 'traceability', 'exceptions', 'balances'] as const;

export default function InventoryReportsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await api.get<any>('/reports/inventory/dashboard-cards'); setData({ cards: res.cards }); } catch (err: any) { setError(err?.message || t('reports.loadFailed')); } finally { setLoading(false); }
  }, [t]);

  const fetchReports = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (warehouseId) params.warehouseId = warehouseId;
      if (productId) params.productId = productId;
      let res: any;
      switch (activeTab) {
        case 'stockCard': res = await api.get<any>('/reports/inventory/stock-card', { params }); break;
        case 'movements': res = await api.get<any>('/reports/inventory/movements', { params }); break;
        case 'traceability': res = await api.get<any>('/reports/inventory/movements', { params: { ...params, limit: 20 } }); break;
        case 'exceptions': res = await api.get<any>('/reports/inventory/exceptions', { params }); break;
        case 'balances': res = await api.get<any>('/reports/inventory/balances', { params }); break;
        default: res = await api.get<any>('/reports/inventory/dashboard-cards'); break;
      }
      setData(res);
    } catch (err: any) { setError(err?.message || t('reports.loadFailed')); } finally { setLoading(false); }
  }, [activeTab, filters, warehouseId, productId, t]);

  useEffect(() => { if (activeTab === 'dashboard') fetchDashboard(); else fetchReports(); }, [activeTab, fetchDashboard, fetchReports]);

  const { exec } = useStableHandlers({ refresh: () => { if (activeTab === 'dashboard') fetchDashboard(); else fetchReports(); } });
  useRegisterAdminActions([{ id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') }]);

  const tabLabels: Record<string, string> = { dashboard: t('reports.inventoryOverview'), stockCard: t('reports.stockCard'), movements: t('reports.movementsReport'), traceability: t('reports.traceability'), exceptions: t('reports.exceptions'), balances: t('reports.balancesReport') };

  return (
    <div>
      <PageHeader title={t('reports.inventoryReports')} />
      <div className="flex gap-2 mb-4 border-b pb-2 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{tabLabels[tab] || tab}</button>
        ))}
      </div>
      {loading && <LoadingState />}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>}
      {!loading && !error && data && (
        <div className="space-y-4">
          {data.cards && <ReportSummaryCards cards={data.cards} />}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Card><CardContent><button onClick={() => router.push('/admin/inventory/reports/stock-card')} className="w-full text-left"><h3 className="font-semibold text-blue-600">{t('reports.stockCard')}</h3><p className="text-sm text-gray-500">{t('reports.stockCardDesc')}</p></button></CardContent></Card>
              <Card><CardContent><button onClick={() => router.push('/admin/reports/inventory/movements')} className="w-full text-left"><h3 className="font-semibold text-blue-600">{t('reports.movementsReport')}</h3><p className="text-sm text-gray-500">{t('reports.movementsReportDesc')}</p></button></CardContent></Card>
              <Card><CardContent><button onClick={() => router.push('/admin/inventory/reports/traceability')} className="w-full text-left"><h3 className="font-semibold text-blue-600">{t('reports.traceability')}</h3><p className="text-sm text-gray-500">{t('reports.traceabilityDesc')}</p></button></CardContent></Card>
              <Card><CardContent><button onClick={() => router.push('/admin/inventory/reports/exceptions')} className="w-full text-left"><h3 className="font-semibold text-blue-600">{t('reports.exceptions')}</h3><p className="text-sm text-gray-500">{t('reports.exceptionsDesc')}</p></button></CardContent></Card>
              <Card><CardContent><button onClick={() => router.push('/admin/reports/inventory/balances')} className="w-full text-left"><h3 className="font-semibold text-blue-600">{t('reports.balancesReport')}</h3><p className="text-sm text-gray-500">{t('reports.balancesReportDesc')}</p></button></CardContent></Card>
            </div>
          )}
          {data.rows && data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse"><thead><tr className="bg-[#1a5632] text-white">{Object.keys(data.rows[0]).filter(k => k !== 'id').map(k => <th key={k} className="px-3 py-2 text-left">{k}</th>)}</tr></thead><tbody>{data.rows.map((row: any, i: number) => <tr key={row.id || i} className="border-b hover:bg-gray-50">{Object.keys(data.rows[0]).filter(k => k !== 'id').map(k => <td key={k} className="px-3 py-2">{typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}</td>)}</tr>)}</tbody></table>
            </div>
          )}
          {activeTab === 'traceability' && data.rows && (
            <div className="mt-4 p-4 bg-blue-50 rounded text-sm">{t('reports.clickMovementForTrace')}</div>
          )}
        </div>
      )}
    </div>
  );
}
