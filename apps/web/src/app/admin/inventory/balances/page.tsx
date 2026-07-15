'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { InventoryBalance } from '../../../../lib/admin-types';
import { Button, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, ConfirmDialog } from '../../../../components/admin/ui';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionRecalculateIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryBalancesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<InventoryBalance[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const canRecalculate = false; // TODO: wire up with inventory-balance:recalculate permission check

  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    recalculate: () => handleRecalculate(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'recalculate', labelKey: 'inventoryCounting.recalculateBalances', icon: <ActionRecalculateIcon />, onClick: () => exec('recalculate') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: InventoryBalance[]; meta: any }>('/inventory/balances', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const handleRecalculate = async () => {
    setSaving(true);
    try {
      await api.post('/inventory/balances/recalculate');
      showToast(t('common.successUpdated'), 'success');
      setRecalculateOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr || '-';
    }
  };

  const columns = [
    { key: 'productCode', header: t('inventory.productCode'), render: (b: InventoryBalance) => b.product?.code || '-' },
    { key: 'productName', header: t('inventory.productName'), render: (b: InventoryBalance) => b.product?.name || '-' },
    { key: 'warehouse', header: t('inventory.warehouse'), render: (b: InventoryBalance) => b.warehouse?.name || '-' },
    { key: 'location', header: t('inventory.location'), render: (b: InventoryBalance) => b.warehouseLocation?.name || '-' },
    { key: 'quantity', header: t('inventoryCounting.quantity'), render: (b: InventoryBalance) => b.quantity },
    { key: 'unit', header: t('inventory.unit'), render: (b: InventoryBalance) => b.product?.unit || '-' },
    { key: 'updatedAt', header: t('common.updatedAt'), render: (b: InventoryBalance) => formatDate(b.updatedAt) },
  ];

  return (
    <div>
      <PageHeader title={t('inventoryCounting.balances')} />
      <Toolbar
        searchValue={search}
        onSearchChange={setSearch}
        onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)}
        loading={loading}
        extraActions={
          canRecalculate ? (
            <Button variant="secondary" onClick={() => setRecalculateOpen(true)}>
              {t('inventoryCounting.recalculateBalances')}
            </Button>
          ) : undefined
        }
      />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('inventoryCounting.loadingBalances')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('inventoryCounting.noBalances')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(b: InventoryBalance) => b.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <ConfirmDialog
        open={recalculateOpen}
        onClose={() => setRecalculateOpen(false)}
        onConfirm={handleRecalculate}
        title={t('common.confirm')}
        message="Are you sure you want to recalculate all inventory balances?"
        variant="primary"
        loading={saving}
      />
    </div>
  );
}
