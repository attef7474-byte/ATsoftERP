'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { AnalyticsPanel } from '../../../../components/factory/unified-production/analytics-panel';
import { PerformanceTargetsPanel } from '../../../../components/factory/unified-production/performance-targets-panel';
import { ReliabilityPanel } from '../../../../components/factory/unified-production/reliability-panel';

type UnifiedTab = 'analytics' | 'performance-targets' | 'reliability';

const TAB_ORDER = ['analytics', 'performance-targets', 'reliability'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  analytics: 'production-analytics:read',
  'performance-targets': 'production-performance-target:read',
  reliability: 'operational-reliability:read',
};

export default function PerformanceAnalyticsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('analytics');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'analytics'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.analyticsWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.analyticsWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.analyticsWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.analyticsWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.analyticsWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'analytics', label: t('production.analytics.title') },
          { id: 'performance-targets', label: t('production.performanceTargets.title') },
          { id: 'reliability', label: t('productionReliability.title') },
        ].filter((item) => isVisible(item.id))}
      />
      <TabPanel id="analytics" activeId={tab}>
        <AnalyticsPanel />
      </TabPanel>
      <TabPanel id="performance-targets" activeId={tab}>
        <PerformanceTargetsPanel />
      </TabPanel>
      <TabPanel id="reliability" activeId={tab}>
        <ReliabilityPanel />
      </TabPanel>
    </div>
  );
}
