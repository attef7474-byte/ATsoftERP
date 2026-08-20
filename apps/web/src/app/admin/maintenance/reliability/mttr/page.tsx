'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PageHeader, Card, Select } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

interface MttrData {
  mttrHours?: number; totalDowntimeHours?: number; totalRepairs?: number;
  period?: string;
}

export default function MttrPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<MttrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30');

  const { exec } = useStableHandlers({ refresh: () => fetchData() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MttrData>('/maintenance/reliability/mttr', { params: { days: period } });
      setData(res);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t, period]);

  useEffect(() => { fetchData(); }, [period]);

  if (error) return <div className="p-8 text-center text-red-500">{error}<button onClick={fetchData} className="mr-2 underline">{t('common.retry')}</button></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title={t('maintenance.mttr')} />
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-32"
          options={[
            { value: '7', label: t('status.last7Days') },
            { value: '30', label: t('status.last30Days') },
            { value: '90', label: t('status.last90Days') },
            { value: '365', label: t('status.lastYear') },
          ]}
        />
      </div>
      {loading ? (
        <div className="p-8 text-center">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{data?.mttrHours?.toFixed(1) ?? '-'}</div>
            <div className="text-sm text-gray-500 mt-1">{t('maintenance.mttrHours')}</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600">{data?.totalDowntimeHours?.toFixed(1) ?? '-'}</div>
            <div className="text-sm text-gray-500 mt-1">{t('maintenance.totalDowntimeHours')}</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{data?.totalRepairs ?? '-'}</div>
            <div className="text-sm text-gray-500 mt-1">{t('maintenance.totalRepairs')}</div>
          </Card>
        </div>
      )}
    </div>
  );
}