'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { DowntimePanel } from '../../../../components/factory/unified-production/downtime-panel';
import { LossesPanel } from '../../../../components/factory/unified-production/losses-panel';
import { LossReasonsPanel } from '../../../../components/factory/unified-production/loss-reasons-panel';

type UnifiedTab = 'downtime' | 'losses' | 'loss-reasons';

export default function DowntimeLossesWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'losses' ? 'losses' : initial === 'loss-reasons' ? 'loss-reasons' : 'downtime',
  );
  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'downtime' || requested === 'losses' || requested === 'loss-reasons') {
      setTab(requested);
    }
  }, [searchParams]);
  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);
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
        ]}
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
