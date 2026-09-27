'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MaintenanceRequestPartUsage } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function PartsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const id = params.id as string;
  const [parts, setParts] = useState<MaintenanceRequestPartUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceRequestPartUsage[]>('/maintenance/request-parts', { params: { requestId: id } });
      setParts(Array.isArray(res) ? res : []);
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
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.legacyPartsTitle')}</h3></CardHeader>
        <CardContent>
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm mb-4">
            <div className="font-medium">{t('maintenanceWorkflow.legacyPartsReadOnlyNotice')}</div>
            <div className="mt-1">{t('maintenanceWorkflow.legacyPartsExcludedNotice')}</div>
            <div className="mt-1">{t('maintenanceWorkflow.legacyPartsWhereToRecord')}</div>
          </div>
          {parts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'product', header: t('maintenanceWorkflow.partProduct'), render: (p: MaintenanceRequestPartUsage) => p.product?.name || p.productId },
              { key: 'quantity', header: t('maintenanceWorkflow.partQuantity'), render: (p: MaintenanceRequestPartUsage) => p.quantity },
              { key: 'unitCost', header: t('maintenanceWorkflow.partUnitCost'), render: (p: MaintenanceRequestPartUsage) => p.unitCost ?? '-' },
              { key: 'totalCost', header: t('maintenanceWorkflow.partTotalCost'), render: (p: MaintenanceRequestPartUsage) => p.totalCost ?? '-' },
              { key: 'notes', header: t('maintenanceWorkflow.partNotes'), render: (p: MaintenanceRequestPartUsage) => p.notes || '-' },
            ]} data={parts} keyExtractor={(p: MaintenanceRequestPartUsage) => p.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
