'use client';

import React from 'react';
import { PageHeader } from '../../../../components/admin/ui';
import { IssueVouchersPanel } from '../../../../components/inventory/issue-vouchers-panel';
import { useTranslation } from '../../../../lib/i18n/use-translation';
export default function IssueVouchersPage() {
  const {
    t
  } = useTranslation();
  return <div><PageHeader title={t('inventory.issueVoucher.title')} subtitle={t('inventory.issueVoucher.subtitle')} /><IssueVouchersPanel /></div>;
}
