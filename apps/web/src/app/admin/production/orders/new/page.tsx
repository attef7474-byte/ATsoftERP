'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PageHeader, Button } from '../../../../../components/admin/ui';
import { OrderForm } from '../_components/order-form';
import type { ProductionOrder } from '../../../../../lib/admin-types';

export default function NewProductionOrderPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const canCreate = isSuperAdmin || Boolean(permissions?.permissions.includes('production-order:create'));

  if (!canCreate) {
    return (
      <div>
        <PageHeader title={t('production.orders.newOrder')} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('errors.forbidden')}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.orders.newOrder')} />
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <OrderForm
          onSaved={(order: ProductionOrder) => router.push('/admin/production/orders/' + order.id)}
          onCancel={() => router.push('/admin/production/orders')}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => router.push('/admin/production/orders')}>{t('common.backToList')}</Button>
      </div>
    </div>
  );
}