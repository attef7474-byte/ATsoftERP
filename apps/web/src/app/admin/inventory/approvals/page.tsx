'use client';

import React from 'react';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { PageHeader } from '../../../../components/admin/ui';
import { WarehouseApprovalsPanel } from '../../../../components/inventory/warehouse-approvals-panel';

export default function WarehouseApprovalsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t('inventory.warehouseApprovals.title')}
        subtitle={t('inventory.warehouseApprovals.subtitle')}
      />
      <WarehouseApprovalsPanel />
    </div>
  );
}
