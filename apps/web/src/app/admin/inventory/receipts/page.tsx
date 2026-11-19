'use client';

import React from 'react';
import { PageHeader } from '../../../../components/admin/ui';
import { ReceiptVouchersPanel } from '../../../../components/inventory/receipt-vouchers-panel';
import { useTranslation } from '../../../../lib/i18n/use-translation';

export default function ReceiptVouchersPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('inventory.receiptVoucher.title')} subtitle={t('inventory.receiptVoucher.subtitle')} />
      <ReceiptVouchersPanel />
    </div>
  );
}
