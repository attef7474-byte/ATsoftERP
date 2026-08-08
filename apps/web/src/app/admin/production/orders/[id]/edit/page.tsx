'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useAuth } from '../../../../../../lib/auth-context';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { Button, PageHeader } from '../../../../../../components/admin/ui';
import { OrderForm } from '../../_components/order-form';
import { ORDER_EDITABLE_STATUSES } from '../../_components/order-labels';
import type { ProductionOrder } from '../../../../../../lib/admin-types';

export default function EditProductionOrderPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = String(params?.id || '');
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const handleApiError = useApiErrorHandler();
  const canUpdate = isSuperAdmin || Boolean(permissions?.permissions.includes('production-order:update'));

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState('');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await api.get<ProductionOrder>('/production/orders/' + id);
      if (!ORDER_EDITABLE_STATUSES.includes(loaded.status)) {
        setForbidden(t('production.orders.errors.notEditable'));
        return;
      }
      setOrder(loaded);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [id, t, handleApiError]);

  useEffect(() => {
    if (id && canUpdate) fetchOrder();
  }, [id, canUpdate, fetchOrder]);

  if (!canUpdate) {
    return (
      <div>
        <PageHeader title={t('production.orders.editOrder')} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('errors.forbidden')}</div>
      </div>
    );
  }

  if (loading) {
    return <div><PageHeader title={t('production.orders.editOrder')} /><div className="text-gray-500">{t('common.loading')}</div></div>;
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title={t('production.orders.editOrder')} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{forbidden}</div>
        <div className="mt-4"><Button variant="secondary" onClick={() => router.push('/admin/production/orders/' + id)}>{t('common.backToList')}</Button></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader title={t('production.orders.editOrder')} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || t('common.notFound')}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.orders.editOrder')} subtitle={order.orderNumber} />
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <OrderForm
          initial={order}
          onSaved={(saved: ProductionOrder) => router.push('/admin/production/orders/' + saved.id)}
          onCancel={() => router.push('/admin/production/orders/' + id)}
        />
      </div>
    </div>
  );
}