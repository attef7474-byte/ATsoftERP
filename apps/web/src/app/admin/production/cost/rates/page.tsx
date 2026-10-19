'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../../components/admin/ui';
import { CostRatesPanel } from '../../../../../components/factory/unified-production/cost-rates-panel';
import { CostSnapshotsPanel } from '../../../../../components/factory/unified-production/cost-snapshots-panel';
import { CostTransactionsPanel } from '../../../../../components/factory/unified-production/cost-transactions-panel';
import { OverheadAllocationsPanel } from '../../../../../components/factory/unified-production/overhead-allocations-panel';

type UnifiedTab = 'rates' | 'snapshots' | 'transactions' | 'overhead-allocations';

const TAB_ORDER = ['rates', 'snapshots', 'transactions', 'overhead-allocations'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  rates: 'production-cost-rate:read',
  snapshots: 'production-cost-snapshot:read',
  transactions: 'production-cost-transaction:read',
  'overhead-allocations': 'production-cost-overhead-allocation:read',
};

export default function ProductionCostWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('rates');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'rates'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.costWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.costWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

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
        ].filter((item) => isVisible(item.id))}
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
