'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { MaterialRequirementsPanel } from '../../../../components/factory/unified-production/material-requirements-panel';
import { MaterialDocumentsPanel } from '../../../../components/factory/unified-production/material-documents-panel';
import { FinishedGoodsReceiptsPanel } from '../../../../components/factory/unified-production/finished-goods-receipts-panel';

type UnifiedTab = 'requirements' | 'documents' | 'finished-goods';

const TAB_ORDER = ['requirements', 'documents', 'finished-goods'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  requirements: 'production-material-requirement:read',
  documents: 'production-material-document:read',
  'finished-goods': 'production-finished-goods-receipt:read',
};

export default function MaterialDocumentsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('requirements');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'requirements'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
  }, [isVisible]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.materialDocumentsWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.materialDocumentsWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.materialDocumentsWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.materialDocumentsWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.materialDocumentsWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'requirements', label: t('production.materialRequirements.title') },
          { id: 'documents', label: t('production.materialDocuments.title') },
          { id: 'finished-goods', label: t('production.finishedGoodsReceipts.title') },
        ].filter((item) => isVisible(item.id))}
      />
      <TabPanel id="requirements" activeId={tab}>
        <MaterialRequirementsPanel />
      </TabPanel>
      <TabPanel id="documents" activeId={tab}>
        <MaterialDocumentsPanel />
      </TabPanel>
      <TabPanel id="finished-goods" activeId={tab}>
        <FinishedGoodsReceiptsPanel />
      </TabPanel>
    </div>
  );
}