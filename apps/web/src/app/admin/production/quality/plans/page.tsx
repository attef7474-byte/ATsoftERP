'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../../components/admin/ui';
import { QualityPlansPanel } from '../../../../../components/factory/unified-production/quality-plans-panel';
import { QualityInspectionsPanel } from '../../../../../components/factory/unified-production/quality-inspections-panel';
import { QualityNcrsPanel } from '../../../../../components/factory/unified-production/quality-ncrs-panel';

type UnifiedTab = 'plans' | 'inspections' | 'ncrs';

export default function QualityWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'inspections' ? 'inspections' : initial === 'ncrs' ? 'ncrs' : 'plans',
  );
  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'plans' || requested === 'inspections' || requested === 'ncrs') {
      setTab(requested);
    }
  }, [searchParams]);
  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);
  return (
    <div>
      <PageHeader title={t('production.qualityWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.qualityWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.qualityWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'plans', label: t('production.qualityPlans.title') },
          { id: 'inspections', label: t('production.inspections.title') },
          { id: 'ncrs', label: t('production.ncrs.title') },
        ]}
      />
      <TabPanel id="plans" activeId={tab}>
        <QualityPlansPanel />
      </TabPanel>
      <TabPanel id="inspections" activeId={tab}>
        <QualityInspectionsPanel />
      </TabPanel>
      <TabPanel id="ncrs" activeId={tab}>
        <QualityNcrsPanel />
      </TabPanel>
    </div>
  );
}
