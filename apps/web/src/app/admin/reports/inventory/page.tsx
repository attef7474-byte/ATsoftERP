'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, DataTable } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards } from '../../../../components/reports';

export default function InventoryOverviewReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/inventory/overview');
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const whColumns = [
    { key: 'warehouseId', header: t('reports.warehouse') },
    { key: 'totalQuantity', header: t('reports.totalQuantity') },
    { key: 'count', header: t('reports.total') },
  ];

  const recentColumns = (type: string) => [
    { key: type === 'count' ? 'countNumber' : type === 'movement' ? 'movementNumber' : 'adjustmentNumber', header: t('common.code') },
    { key: 'warehouse', header: t('reports.warehouse'), render: (r: any) => r.warehouse?.name || '-' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <ReportPageShell title={t('reports.inventoryOverview')} description={t('reports.inventoryReports')} loading={loading} error={error} onRetry={fetchData}>
      {data && (
        <div className="space-y-6">
          <ReportSummaryCards cards={data.cards} />
          <Card>
            <CardHeader><h3 className="font-semibold">{t('reports.balancesByWarehouse')}</h3></CardHeader>
            <CardContent><DataTable columns={whColumns} data={data.balancesByWarehouse || []} keyExtractor={(r: any) => r.warehouseId} /></CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.recentCounts')}</h3></CardHeader>
              <CardContent>
                <DataTable columns={recentColumns('count')} data={data.recentCounts || []} keyExtractor={(r: any) => r.id}
                  onRowClick={(r: any) => router.push(`/admin/inventory/counts/${r.id}`)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.recentMovements')}</h3></CardHeader>
              <CardContent>
                <DataTable columns={recentColumns('movement')} data={data.recentMovements || []} keyExtractor={(r: any) => r.id}
                  onRowClick={(r: any) => router.push(`/admin/inventory/movements/${r.id}`)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.recentAdjustments')}</h3></CardHeader>
              <CardContent>
                <DataTable columns={recentColumns('adjustment')} data={data.recentAdjustments || []} keyExtractor={(r: any) => r.id}
                  onRowClick={(r: any) => router.push(`/admin/inventory/adjustments/${r.id}`)} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </ReportPageShell>
  );
}
