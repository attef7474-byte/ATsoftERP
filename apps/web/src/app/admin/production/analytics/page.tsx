'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { AnalyticsPanel } from '../../../../components/factory/unified-production/analytics-panel';
import { PerformanceTargetsPanel } from '../../../../components/factory/unified-production/performance-targets-panel';
import { ReliabilityPanel } from '../../../../components/factory/unified-production/reliability-panel';

type UnifiedTab = 'analytics' | 'performance-targets' | 'reliability';

export default function PerformanceAnalyticsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'performance-targets' ? 'performance-targets' : initial === 'reliability' ? 'reliability' : 'analytics',
  );
  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'analytics' || requested === 'performance-targets' || requested === 'reliability') {
      setTab(requested);
    }
  }, [searchParams]);
  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);
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
        ]}
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
