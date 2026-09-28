'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MaintenanceRequestCostEntry } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';
import { CanonicalCostSummary } from '../../../../../../lib/canonical-cost-types';
import { canonicalCostEventLabel } from '../../../../../../lib/maintenance-labels';

export default function CostEntriesPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const id = params.id as string;
  const [entries, setEntries] = useState<MaintenanceRequestCostEntry[]>([]);
  const [summary, setSummary] = useState<CanonicalCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [legacy, canonical] = await Promise.all([
        api.get<MaintenanceRequestCostEntry[]>('/maintenance/request-costs', { params: { requestId: id } }),
        api.get<CanonicalCostSummary>(`/maintenance-cost/requests/${id}/cost-summary`),
      ]);
      setEntries(Array.isArray(legacy) ? legacy : []);
      setSummary(canonical ?? null);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.canonicalCostTitle')}</h3></CardHeader>
        <CardContent>
          {summary ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-gray-500">{t('maintenanceWorkflow.canonicalCostNet')}</div>
                  <div className="text-xl font-semibold">
                    {summary.netCost} {summary.currencyCode ?? ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('maintenanceWorkflow.canonicalCostPostedEntries')}</div>
                  <div className="text-xl font-semibold">{summary.postedEntryCount}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('maintenanceWorkflow.canonicalCostReversals')}</div>
                  <div className="text-xl font-semibold">{summary.reversalEntryCount}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('maintenanceWorkflow.canonicalCostSource')}</div>
                  <div className="text-sm font-medium">{t('maintenanceWorkflow.canonicalCostTitle')}</div>
                </div>
              </div>

              {summary.postedEntryCount === 0 && (
                <p className="text-sm text-gray-500">{t('maintenanceWorkflow.canonicalCostNoLedgerRows')}</p>
              )}

              {summary.byEventType.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">{t('maintenanceWorkflow.canonicalCostByEvent')}</div>
                  <DataTable
                    columns={[
                      { key: 'key', header: t('maintenanceWorkflow.costType'), render: (b: any) => canonicalCostEventLabel(b.key, t) },
                      { key: 'netAmount', header: t('maintenanceWorkflow.canonicalCostNet'), render: (b: any) => b.netAmount },
                      { key: 'entryCount', header: t('maintenanceWorkflow.canonicalCostPostedEntries'), render: (b: any) => b.entryCount },
                    ]}
                    data={summary.byEventType}
                    keyExtractor={(b: any) => b.key}
                  />
                </div>
              )}

              {summary.sourceReconciliation.unpostedSourceEntryCount > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <div className="font-medium">{t('maintenanceWorkflow.canonicalCostUnposted')}: {summary.sourceReconciliation.unpostedSourceEntryCount}</div>
                  {summary.sourceReconciliation.nextAction && (
                    <div className="mt-1">
                      <span className="font-medium">{t('maintenanceWorkflow.canonicalCostUnpostedNext')}: </span>
                      {summary.sourceReconciliation.nextAction}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('common.noData')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.legacyCostTitle')}</h3></CardHeader>
        <CardContent>
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm mb-4">
            <div className="font-medium">{t('maintenanceWorkflow.legacyCostReadOnlyNotice')}</div>
            <div className="mt-1">{t('maintenanceWorkflow.legacyCostExcludedNotice')}</div>
            <div className="mt-1">{t('maintenanceWorkflow.legacyCostWhereToRecord')}</div>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'type', header: t('maintenanceWorkflow.costType'), render: (e: MaintenanceRequestCostEntry) => t(`maintenanceWorkflow.cost${e.type.charAt(0) + e.type.slice(1).toLowerCase()}` as any) },
              { key: 'description', header: t('maintenanceWorkflow.costDescription'), render: (e: MaintenanceRequestCostEntry) => e.description || '-' },
              { key: 'amount', header: t('maintenanceWorkflow.costAmount'), render: (e: MaintenanceRequestCostEntry) => `${e.amount} (${t('maintenanceWorkflow.legacyCostTitle')})` },
              { key: 'incurredAt', header: t('maintenanceWorkflow.costDate'), render: (e: MaintenanceRequestCostEntry) => new Date(e.incurredAt).toLocaleDateString() },
            ]} data={entries} keyExtractor={(e: MaintenanceRequestCostEntry) => e.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
