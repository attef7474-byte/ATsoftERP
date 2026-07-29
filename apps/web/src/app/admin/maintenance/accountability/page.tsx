'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { PageHeader, Card, CardContent, CardHeader, LoadingState, ErrorState, DataTable, LocalizedValue } from '../../../../components/admin/ui';

interface AccountabilityKpis {
  personnelByRole: { role: string; count: number }[];
  activeResponsibilities: number;
  topAssignees: { personnel: { id: string; code: string; name: string; role: string } | null; activeAssignmentCount: number }[];
  machinesWithMostResponsibilities: { machine: { id: string; code: string; name: string } | null; responsibilityCount: number }[];
  partAccountabilityByStatus: { status: string; count: number }[];
  topPersonnelPartAccountability: { personnel: { id: string; code: string; name: string; role: string } | null; recordCount: number; totalQuantity: number }[];
}

export default function AccountabilityPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<AccountabilityKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<AccountabilityKpis>(`/maintenance/dashboard/accountability-kpis`);
      setData(res);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('common.noData')} />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('maintenanceDashboard.accountabilityKpis')} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.kpiTotalPersonnel')}</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.personnelByRole.reduce((s, r) => s + r.count, 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.activeResponsibilities')}</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.activeResponsibilities}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.kpiActiveAssignments')}</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.topAssignees.reduce((s, a) => s + a.activeAssignmentCount, 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.kpiPartAccountabilities')}</h3></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.partAccountabilityByStatus.reduce((s, p) => s + p.count, 0)}</p></CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.personnelByRole')}</h3></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'role', header: t('maintenance.personnelRole'), render: (r: any) => <LocalizedValue value={r.role} /> },
                { key: 'count', header: t('common.count') },
              ]}
              data={data.personnelByRole}
              keyExtractor={(r) => r.role}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.partAccountabilityByStatus')}</h3></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'status', header: t('common.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
                { key: 'count', header: t('common.count') },
              ]}
              data={data.partAccountabilityByStatus}
              keyExtractor={(p) => p.status}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.topAssignees')}</h3></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'name', header: t('maintenance.personnelName'), render: (r: any) => r.personnel ? `[${r.personnel.code}] ${r.personnel.name}` : '-' },
                { key: 'role', header: t('maintenance.personnelRole'), render: (r: any) => <LocalizedValue value={r.personnel?.role} /> },
                { key: 'activeAssignmentCount', header: t('common.count') },
              ]}
              data={data.topAssignees}
              keyExtractor={(r: any) => r.personnel?.id || Math.random().toString()}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.machinesWithMostResponsibilities')}</h3></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'name', header: t('maintenance.machine'), render: (r: any) => r.machine ? `[${r.machine.code}] ${r.machine.name}` : '-' },
                { key: 'responsibilityCount', header: t('common.count') },
              ]}
              data={data.machinesWithMostResponsibilities}
              keyExtractor={(r: any) => r.machine?.id || Math.random().toString()}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><h3 className="text-sm font-medium">{t('maintenanceDashboard.topPersonnelPartAccountability')}</h3></CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'name', header: t('maintenance.personnelName'), render: (r: any) => r.personnel ? `[${r.personnel.code}] ${r.personnel.name}` : '-' },
              { key: 'role', header: t('maintenance.personnelRole'), render: (r: any) => r.personnel?.role || '-' },
              { key: 'recordCount', header: t('common.count') },
              { key: 'totalQuantity', header: t('maintenance.assignedQuantity') },
            ]}
            data={data.topPersonnelPartAccountability}
            keyExtractor={(r: any) => r.personnel?.id || Math.random().toString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
