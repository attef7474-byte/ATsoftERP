'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { Card, CardContent, LoadingState, ErrorState, PageHeader } from '../../../../components/admin/ui';
import { useRegisterAdminActions, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/maintenance/dashboard/summary');
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!summary) return <ErrorState message={t('common.noData')} onRetry={fetchData} />;

  const kpiCards = [
    { label: t('maintenanceDashboard.openRequests'), value: summary.openRequests, color: 'bg-blue-500', link: '/admin/maintenance/dashboard/open-requests' },
    { label: t('maintenanceDashboard.criticalRequests'), value: summary.criticalRequests, color: 'bg-red-500', link: '/admin/maintenance/dashboard/critical' },
    { label: t('maintenanceDashboard.overdueItems'), value: summary.overdueItems, color: 'bg-yellow-500', link: '/admin/maintenance/dashboard/overdue' },
    { label: t('maintenanceDashboard.machinesUnderMaintenance'), value: summary.machinesUnderMaintenance, color: 'bg-purple-500', link: '/admin/maintenance/dashboard/machines-under-maintenance' },
    { label: t('maintenanceDashboard.currentDowntime'), value: summary.currentDowntime, color: 'bg-orange-500', link: '/admin/maintenance/dashboard/current-downtime' },
    { label: t('maintenanceDashboard.upcomingPreventive'), value: summary.upcomingPreventive, color: 'bg-green-500', link: '/admin/maintenance/dashboard/upcoming-preventive' },
    { label: t('maintenanceDashboard.totalCost'), value: `${summary.totalCost?.toLocaleString() || '0'} ${t('common.currency')}`, color: 'bg-teal-500', link: '/admin/maintenance/dashboard/cost-kpis' },
    { label: t('maintenanceDashboard.completionRate'), value: `${summary.completionRate || 0}%`, color: 'bg-indigo-500', link: '/admin/maintenance/requests' },
    { label: t('maintenanceDashboard.slaOverdue') || 'SLA Overdue', value: summary.slaOverdue ?? '-', color: 'bg-red-500', link: '/admin/maintenance/dashboard/sla-overdue' },
    { label: t('maintenanceDashboard.slaEscalated') || 'SLA Escalated', value: summary.slaEscalated ?? '-', color: 'bg-amber-500', link: '/admin/maintenance/dashboard/sla-escalated' },
    { label: t('maintenanceDashboard.unreadNotifications') || 'Unread Notifications', value: summary.unreadNotifications ?? '-', color: 'bg-pink-500', link: '/admin/notifications' },
  ];

  const reliability = summary.reliability;
  const reliabilityCards = reliability ? [
    { label: t('maintenance.mttr'), value: reliability.mttr ? `${reliability.mttr.toFixed(2)} h` : '-', color: 'bg-cyan-500' },
    { label: t('maintenance.mtbf'), value: reliability.mtbf ? `${reliability.mtbf.toFixed(2)} h` : '-', color: 'bg-emerald-500' },
    { label: t('maintenance.totalDowntime'), value: reliability.totalDowntimeHours ? `${reliability.totalDowntimeHours.toFixed(1)} h` : '0 h', color: 'bg-rose-500' },
    { label: t('maintenance.reliabilityKpis'), value: `${reliability.totalDowntimeEvents || 0} ${t('common.events')}`, color: 'bg-violet-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenanceDashboard.title')} subtitle={t('maintenanceDashboard.subtitle')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push(kpi.link)}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${kpi.color} opacity-20`} />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {reliabilityCards.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('maintenance.reliabilityKpis')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reliabilityCards.map((kpi, i) => (
              <div key={i}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{kpi.label}</p>
                        <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-full ${kpi.color} opacity-20`} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
