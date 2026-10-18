'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuth } from '../../../../lib/auth-context';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ProductionOrdersPanel } from '../../../../components/factory/unified-production/production-orders-panel';
import { ProductionRunsPanel } from '../../../../components/factory/unified-production/production-runs-panel';
import { MeasurementPointsPanel } from '../../../../components/factory/unified-production/measurement-points-panel';

type UnifiedTab = 'orders' | 'runs' | 'measurement-points';

export default function ProductionOrdersWorkspacePage() {
  const { t } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requested = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>('orders');
  useEffect(() => {
    if (requested === 'runs' || requested === 'measurement-points' || requested === 'orders') setTab(requested);
  }, [requested]);
  const selectTab = useCallback((next: string) => { setTab(next as UnifiedTab); router.replace(`/admin/production/orders?tab=${next}`); }, [router]);
  if (!permissions) return <div><PageHeader title={t('production.productionOrders')} /><p className="text-sm text-gray-500">{t('common.loading')}</p></div>;
  const canOrders = isSuperAdmin || permissions.permissions.includes('production-order:read');
  const canRuns = isSuperAdmin || permissions.permissions.includes('production-run:read');
  const canMP = isSuperAdmin || permissions.permissions.includes('production-measurement-point:read');
  if (!canOrders && !canRuns && !canMP) return <div><PageHeader title={t('production.productionOrders')} /><p className="text-sm text-gray-500">{t('errors.forbidden')}</p></div>;
  const activeTab = tab;
  return (
    <div>
      <PageHeader title={t('production.productionOrders')} />
      <Tabs
        ariaLabel={t('production.productionOrders')}
        activeId={activeTab}
        onChange={selectTab}
        items={[
          ...(canOrders ? [{ id: 'orders', label: t('production.productionOrders') }] : []),
          ...(canRuns ? [{ id: 'runs', label: t('production.runs') }] : []),
          ...(canMP ? [{ id: 'measurement-points', label: t('production.measurementPoints') }] : []),
        ]}
      />
      {canOrders && <TabPanel id="orders" activeId={activeTab}><ProductionOrdersPanel /></TabPanel>}
      {canRuns && <TabPanel id="runs" activeId={activeTab}><ProductionRunsPanel /></TabPanel>}
      {canMP && <TabPanel id="measurement-points" activeId={activeTab}><MeasurementPointsPanel /></TabPanel>}
    </div>
  );
}
