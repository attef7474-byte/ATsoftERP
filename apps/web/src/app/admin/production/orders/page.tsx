'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ProductionOrdersPanel } from '../../../../components/factory/unified-production/production-orders-panel';
import { ProductionRunsPanel } from '../../../../components/factory/unified-production/production-runs-panel';
import { MeasurementPointsPanel } from '../../../../components/factory/unified-production/measurement-points-panel';
import { ProductionSchedulingPanel } from '../../../../components/factory/unified-production/production-scheduling-panel';

type UnifiedTab = 'orders' | 'runs' | 'measurement-points' | 'scheduling';

const TAB_ORDER = ['orders', 'runs', 'measurement-points', 'scheduling'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  orders: 'production-order:read',
  runs: 'production-run:read',
  'measurement-points': 'production-measurement-point:read',
  scheduling: 'production-order:readiness',
};

export default function ProductionOrdersWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('orders');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'orders'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
    router.replace(`/admin/production/orders?tab=${next}`);
  }, [isVisible, router]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.ordersWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.ordersWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.ordersWorkspace')} />
      <Tabs
        ariaLabel={t('production.ordersWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'orders', label: t('production.orders.title') },
          { id: 'runs', label: t('production.runs.title') },
          { id: 'measurement-points', label: t('production.measurementPoints.title') },
          { id: 'scheduling', label: t('production.planning.tab') },
        ].filter((item) => isVisible(item.id))}
      />
      <TabPanel id="orders" activeId={tab}><ProductionOrdersPanel /></TabPanel>
      <TabPanel id="runs" activeId={tab}><ProductionRunsPanel /></TabPanel>
      <TabPanel id="measurement-points" activeId={tab}><MeasurementPointsPanel /></TabPanel>
      <TabPanel id="scheduling" activeId={tab}><ProductionSchedulingPanel /></TabPanel>
    </div>
  );
}
