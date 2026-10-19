'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../../components/admin/ui';
import { QualityPlansPanel } from '../../../../../components/factory/unified-production/quality-plans-panel';
import { QualityInspectionsPanel } from '../../../../../components/factory/unified-production/quality-inspections-panel';
import { QualityNcrsPanel } from '../../../../../components/factory/unified-production/quality-ncrs-panel';

type UnifiedTab = 'plans' | 'inspections' | 'ncrs';

const TAB_ORDER = ['plans', 'inspections', 'ncrs'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  plans: 'production-quality-plan:read',
  inspections: 'production-inspection:read',
  ncrs: 'production-ncr:read',
};

export default function QualityWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('plans');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'plans'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.qualityWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.qualityWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

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
        ].filter((item) => isVisible(item.id))}
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
