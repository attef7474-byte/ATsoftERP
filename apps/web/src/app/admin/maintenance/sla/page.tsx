'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Card } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface SlaOverview {
  total: number; onTrack: number; overdue: number; escalated: number;
  onTimePercent?: number; avgResponseTime?: number;
}

export default function SlaPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SlaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiAvailable, setApiAvailable] = useState(true);

  const { exec } = useStableHandlers({ refresh: () => fetchData() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    if (!apiAvailable) return;
    setLoading(true); setError('');
    try {
      const res = await api.get<SlaOverview>('/maintenance/sla/stats/overview');
      setData(res);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setApiAvailable(false);
        setData({ total: 0, onTrack: 0, overdue: 0, escalated: 0 });
      } else {
        setError(err?.message || t('errors.loadFailed'));
      }
    }
    finally { setLoading(false); }
  }, [t, apiAvailable]);

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}<button onClick={fetchData} className="mr-2 underline">{t('common.retry')}</button></div>;

  return (
    <div>
      <PageHeader title={t('maintenance.sla')} />
      {!apiAvailable && (
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
            SLA endpoint unavailable — showing default values
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold">{data?.total ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">{t('common.total')}</div>
        </Card>
        <Card className="p-6 text-center border-green-200">
          <div className="text-3xl font-bold text-green-600">{data?.onTrack ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">{t('maintenance.onTrack')}</div>
        </Card>
        <Card className="p-6 text-center border-red-200">
          <div className="text-3xl font-bold text-red-600">{data?.overdue ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">{t('maintenance.overdue')}</div>
        </Card>
        <Card className="p-6 text-center border-orange-200">
          <div className="text-3xl font-bold text-orange-600">{data?.escalated ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">{t('maintenance.escalated')}</div>
        </Card>
      </div>
      {data?.onTimePercent !== undefined && (
        <div className="p-4">
          <Card className="p-6">
            <div className="text-lg font-semibold mb-2">{t('maintenance.slaCompliance')}</div>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-blue-600">{data.onTimePercent}%</div>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${data.onTimePercent}%` }} />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
