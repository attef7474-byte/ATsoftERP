'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ProductDefinitionsPanel } from '../../../../components/factory/unified-production/product-definitions-panel';
import { UnitsPanel } from '../../../../components/factory/unified-production/units-panel';
import { CapacityStandardsPanel } from '../../../../components/factory/unified-production/capacity-standards-panel';

type UnifiedTab = 'product-definitions' | 'units' | 'capacity-standards';

/**
 * Unified Products workspace.
 *
 * Product definitions and their production units are the same daily setup task (defining
 * what the factory makes and in which counting units), so they share one workspace instead
 * of two competing sidebar screens. The former standalone /admin/production/units route is
 * preserved as a redirect stub so bookmarks keep working.
 */
export default function ProductionProductsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(initial === 'units' ? 'units' : initial === 'capacity-standards' ? 'capacity-standards' : 'product-definitions');

  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'units' || requested === 'product-definitions' || requested === 'capacity-standards') {
      setTab(requested);
    }
  }, [searchParams]);

  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);

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
        ]}
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
