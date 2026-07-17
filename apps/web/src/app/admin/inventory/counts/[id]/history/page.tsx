'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, AuditLog, InventoryAdjustment } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryCount | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('audit');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [countRes, historyRes] = await Promise.all([
        api.get<InventoryCount>(`/inventory/counts/${id}`),
        api.get<any>(`/inventory/counts/${id}/history`).catch(() => ({ auditLogs: [], adjustments: [] })),
      ]);
      setData(countRes);
      setAuditLogs(historyRes.auditLogs || []);
      setAdjustments(historyRes.adjustments || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const tabs = [
    { id: 'audit', label: t('details.auditTrail') },
    { id: 'adjustments', label: t('details.inventoryCount.sourceAdjustment') },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countNumber')}</dt><dd className="text-sm text-gray-900 font-semibold">{data.countNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.warehouse')}</dt><dd className="text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'audit' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('settings.audit.title')}</h3></CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('settings.audit.noLogs')}</p> : (
              <DataTable columns={[
                { key: 'createdAt', header: t('settings.audit.timestamp'), render: (l: AuditLog) => fmt(l.createdAt) },
                { key: 'user', header: t('settings.audit.user'), render: (l: AuditLog) => l.user?.name || '-' },
                { key: 'action', header: t('settings.audit.action'), render: (l: AuditLog) => l.action },
                { key: 'details', header: t('settings.audit.details'), render: (l: AuditLog) => l.details || '-' },
              ]} data={auditLogs} keyExtractor={(l: AuditLog) => l.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'adjustments' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.inventoryCount.sourceAdjustment')}</h3></CardHeader>
          <CardContent>
            {adjustments.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'adjustmentNumber', header: t('inventoryCounting.adjustmentNumber'), render: (a: InventoryAdjustment) => (
                  <button onClick={() => router.push(`/admin/inventory/adjustments/${a.id}`)} className="text-indigo-600 hover:text-indigo-800 underline">{a.adjustmentNumber}</button>
                )},
                { key: 'status', header: t('common.status'), render: (a: InventoryAdjustment) => <StatusBadge status={a.status} /> },
                { key: 'createdAt', header: t('common.createdAt'), render: (a: InventoryAdjustment) => fmt(a.createdAt) },
              ]} data={adjustments} keyExtractor={(a: InventoryAdjustment) => a.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
