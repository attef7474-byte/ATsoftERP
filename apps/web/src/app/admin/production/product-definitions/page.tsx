'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ProductsWorkspace } from '../../../../components/inventory/products/products-workspace';
import { ProductDefinitionsPanel } from '../../../../components/factory/unified-production/product-definitions-panel';
import { UnitsPanel } from '../../../../components/factory/unified-production/units-panel';
import { CapacityStandardsPanel } from '../../../../components/factory/unified-production/capacity-standards-panel';

type UnifiedTab = 'products' | 'product-definitions' | 'units' | 'capacity-standards';

const TAB_ORDER = ['products', 'product-definitions', 'units', 'capacity-standards'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  products: 'products:read',
  'product-definitions': 'production-product:read',
  units: 'production-unit:read',
  'capacity-standards': 'production-capacity-standard:read',
};

/**
 * Unified Products workspace.
 *
 * Products and their production configuration are one daily setup task (defining
 * what the factory makes, in which units, and how it is produced). The products tab
 * renders the SAME canonical product workspace as /admin/inventory/products so the
 * product identity is created and edited in exactly one place; the production-configuration
 * tab is a read/list view of the tenant-scoped production definitions and their process
 * children (specifications, versions, packaging, eligibility). The former standalone
 * /admin/production/units route is preserved as a redirect stub so bookmarks keep working.
 * Tabs the operator lacks permission for are hidden and never become the landing tab.
 */
export default function ProductionProductsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('products');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'products'));
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
          { id: 'products', label: t('inventory.products') },
          { id: 'product-definitions', label: t('production.settings') },
          { id: 'units', label: t('production.units') },
          { id: 'capacity-standards', label: t('production.capacityStandards') },
        ].filter((item) => isVisible(item.id))}
      />

      <TabPanel id="products" activeId={tab}>
        <ProductsWorkspace showHeader={false} defaultSection="production" />
      </TabPanel>

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
