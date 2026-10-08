'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel, Select } from '../../../../components/admin/ui';
import { MachineCategoriesPanel } from '../../../../components/maintenance/unified-master-data/machine-categories-panel';
import { OperationTypesPanel } from '../../../../components/maintenance/unified-master-data/operation-types-panel';
import { CategoryOperationTypesPanel } from '../../../../components/maintenance/unified-master-data/category-operation-types-panel';
import { api } from '../../../../lib/api';

type UnifiedTab = 'categories' | 'operation-types' | 'relationships';

const TAB_PARAM = 'tab';

/**
 * R4R — unified Machine Categories & Operation Types.
 *
 * This replaces the two competing standalone screens. Machine categories and operation
 * types are both global factory master data that the same engineer maintains while
 * classifying machines, so they belong on one page with one review flow.
 *
 * There is deliberately NO stored category→operation-type relationship: the schema has
 * no such column and no join table. The relationship is derived from
 * Machine.categoryId → Machine.operationTypeId, so the "Relationships" tab reports that
 * derived reality instead of letting an operator type an association that does not
 * exist. `/admin/maintenance/operation-types` now redirects here, so there is exactly one
 * place to maintain either entity.
 */
export default function MachineCategoriesAndOperationTypesPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const initial = (searchParams?.get(TAB_PARAM) as UnifiedTab | null) ?? 'categories';
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'operation-types' || initial === 'relationships' ? initial : 'categories',
  );

  // Deep links from the retired operation-types screen and from bookmarks keep working.
  useEffect(() => {
    const requested = searchParams?.get(TAB_PARAM) as UnifiedTab | null;
    if (requested === 'operation-types' || requested === 'relationships' || requested === 'categories') {
      setTab(requested);
    }
  }, [searchParams]);

  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);

  const [categories, setCategories] = useState<{ id: string; code: string; name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // The relationships tab needs a category selector. It is loaded only when that tab is
  // opened, so the default categories tab keeps its existing single-request behaviour.
  useEffect(() => {
    if (tab !== 'relationships' || categories.length > 0) return;
    let cancelled = false;
    setCategoriesLoading(true);
    api
      .get<{ data: { id: string; code: string; name: string }[] }>('/maintenance/machine-categories', {
        params: { page: 1, limit: 200 },
      })
      .then((res) => {
        if (cancelled) return;
        const items = res?.data ?? [];
        setCategories(items);
        if (items.length > 0) setSelectedCategoryId((current) => current || items[0].id);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, categories.length]);

  return (
    <div>
      <PageHeader title={t('maintenance.machineCategories')} />
      <p className="text-sm text-gray-500 mb-4">{t('maintenance.machineCategoriesAndOperationTypesDescription')}</p>

      <Tabs
        ariaLabel={t('maintenance.machineCategoriesAndOperationTypes')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'categories', label: t('maintenance.machineCategories'), badge: categories.length || undefined },
          { id: 'operation-types', label: t('maintenance.operationTypes') },
          { id: 'relationships', label: t('maintenance.categoryOperationTypes') },
        ]}
      />

      <TabPanel id="categories" activeId={tab}>
        <MachineCategoriesPanel />
      </TabPanel>

      <TabPanel id="operation-types" activeId={tab}>
        <OperationTypesPanel />
      </TabPanel>

      <TabPanel id="relationships" activeId={tab}>
        <div className="space-y-4">
          <div className="max-w-md">
            <Select
              label={t('maintenance.machineCategory')}
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={categoriesLoading || categories.length === 0}
              options={[
                { value: '', label: t('maintenance.selectCategoryFirst') },
                ...categories.map((category) => ({
                  value: category.id,
                  label: `${category.code} - ${category.name}`,
                })),
              ]}
            />
          </div>
          {categoriesLoading ? (
            <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
          ) : (
            <CategoryOperationTypesPanel categoryId={selectedCategoryId} />
          )}
        </div>
      </TabPanel>
    </div>
  );
}