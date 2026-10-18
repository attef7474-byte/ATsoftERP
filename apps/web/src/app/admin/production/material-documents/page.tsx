'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { MaterialRequirementsPanel } from '../../../../components/factory/unified-production/material-requirements-panel';
import { MaterialDocumentsPanel } from '../../../../components/factory/unified-production/material-documents-panel';
import { FinishedGoodsReceiptsPanel } from '../../../../components/factory/unified-production/finished-goods-receipts-panel';

type UnifiedTab = 'requirements' | 'documents' | 'finished-goods';

export default function MaterialDocumentsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab>(
    initial === 'documents' ? 'documents' : initial === 'finished-goods' ? 'finished-goods' : 'requirements',
  );
  useEffect(() => {
    const requested = searchParams?.get('tab') as UnifiedTab | null;
    if (requested === 'documents' || requested === 'finished-goods' || requested === 'requirements') {
      setTab(requested);
    }
  }, [searchParams]);
  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
  }, []);
  return (
    <div>
      <PageHeader title={t('production.materialDocumentsWorkspace')} />
      <p className="text-sm text-gray-500 mb-4">{t('production.materialDocumentsWorkspaceDescription')}</p>
      <Tabs
        ariaLabel={t('production.materialDocumentsWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={[
          { id: 'requirements', label: t('production.materialRequirements') },
          { id: 'documents', label: t('production.materialDocuments') },
          { id: 'finished-goods', label: t('production.finishedGoodsReceipts') },
        ]}
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