'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ProductDefinitionsPanel } from '../../../../components/factory/unified-production/product-definitions-panel';
import { UnitsPanel } from '../../../../components/factory/unified-production/units-panel';
import { CapacityStandardsPanel } from '../../../../components/factory/unified-production/capacity-standards-panel';

type UnifiedTab = 'product-definitions' | 'units' | 'capacity-standards';

const TAB_ORDER = ['product-definitions', 'units', 'capacity-standards'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  'product-definitions': 'production-product:read',
  units: 'production-unit:read',
  'capacity-standards': 'production-capacity-standard:read',
};

/**
 * Unified Products workspace.
 *
 * Product definitions and their production units are the same daily setup task (defining
 * what the factory makes and in which counting units), so they share one workspace instead
 * of two competing sidebar screens. The former standalone /admin/production/units route is
 * preserved as a redirect stub so bookmarks keep working. Tabs the operator is not
 * authorized for are hidden and never become the landing tab.
 */
export default function ProductionProductsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('product-definitions');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'product-definitions'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.productsWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.productsWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.productsWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.productsWorkspaceDescription')}</p>

      <Tabs
        ariaLabel={t('production.productsWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'product-definitions', label: t('production.productDefinitions') },
          { id: 'units', label: t('production.units') },
          { id: 'capacity-standards', label: t('production.capacityStandards') },
        ].filter((item) => isVisible(item.id))}
      />

      <TabPanel id="product-definitions" activeId={tab}>
        <ProductDefinitionsPanel />
      </TabPanel>

      <TabPanel id="units" activeId={tab}>
        <UnitsPanel />
      </TabPanel>

      <TabPanel id="capacity-standards" activeId={tab}>
        <CapacityStandardsPanel />
      </TabPanel>
    </div>
  );
}
