'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../../components/admin/ui';
import { CostRatesPanel } from '../../../../../components/factory/unified-production/cost-rates-panel';
import { CostSnapshotsPanel } from '../../../../../components/factory/unified-production/cost-snapshots-panel';
import { CostTransactionsPanel } from '../../../../../components/factory/unified-production/cost-transactions-panel';
import { OverheadAllocationsPanel } from '../../../../../components/factory/unified-production/overhead-allocations-panel';

type UnifiedTab = 'rates' | 'snapshots' | 'transactions' | 'overhead-allocations';

export default function ProductionCostWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'snapshots' ? 'snapshots' : initial === 'transactions' ? 'transactions' : initial === 'overhead-allocations' ? 'overhead-allocations' : 'rates',
  );
  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'rates' || requested === 'snapshots' || requested === 'transactions' || requested === 'overhead-allocations') {
      setTab(requested);
    }
  }, [searchParams]);
  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);
  return (
    <div>
      <PageHeader title={t('production.costWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.costWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.costWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'rates', label: t('production.costRates.title') },
          { id: 'snapshots', label: t('production.costSnapshots.title') },
          { id: 'transactions', label: t('production.costTransactions.title') },
          { id: 'overhead-allocations', label: t('overheadAllocation.title') },
        ]}
      />
      <TabPanel id="rates" activeId={tab}>
        <CostRatesPanel />
      </TabPanel>
      <TabPanel id="snapshots" activeId={tab}>
        <CostSnapshotsPanel />
      </TabPanel>
      <TabPanel id="transactions" activeId={tab}>
        <CostTransactionsPanel />
      </TabPanel>
      <TabPanel id="overhead-allocations" activeId={tab}>
        <OverheadAllocationsPanel />
      </TabPanel>
    </div>
  );
}
