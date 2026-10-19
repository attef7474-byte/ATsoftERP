'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { DowntimePanel } from '../../../../components/factory/unified-production/downtime-panel';
import { LossesPanel } from '../../../../components/factory/unified-production/losses-panel';
import { LossReasonsPanel } from '../../../../components/factory/unified-production/loss-reasons-panel';

type UnifiedTab = 'downtime' | 'losses' | 'loss-reasons';

const TAB_ORDER = ['downtime', 'losses', 'loss-reasons'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  downtime: 'production-downtime:read',
  losses: 'production-loss:read',
  'loss-reasons': 'production-loss-reason:read',
};

export default function DowntimeLossesWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('downtime');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'downtime'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.downtimeLossesWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.downtimeLossesWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.downtimeLossesWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.downtimeLossesWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.downtimeLossesWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'downtime', label: t('production.downtime.title') },
          { id: 'losses', label: t('production.losses.title') },
          { id: 'loss-reasons', label: t('production.lossReasons.title') },
        ].filter((item) => isVisible(item.id))}
      />
      <TabPanel id="downtime" activeId={tab}>
        <DowntimePanel />
      </TabPanel>
      <TabPanel id="losses" activeId={tab}>
        <LossesPanel />
      </TabPanel>
      <TabPanel id="loss-reasons" activeId={tab}>
        <LossReasonsPanel />
      </TabPanel>
    </div>
  );
}
