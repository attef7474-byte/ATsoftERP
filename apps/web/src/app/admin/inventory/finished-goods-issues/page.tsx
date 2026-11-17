'use client';

import React from 'react';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader } from '../../../../components/admin/ui';
import { FinishedGoodsIssuesPanel } from '../../../../components/factory/unified-production/finished-goods-issues-panel';

export default function FinishedGoodsIssuesPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t('inventory.finishedGoodsIssue.title')}
        subtitle={t('inventory.finishedGoodsIssue.subtitle')}
      />
      <FinishedGoodsIssuesPanel />
    </div>
  );
}
