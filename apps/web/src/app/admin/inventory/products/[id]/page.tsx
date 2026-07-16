'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Product, InventoryBalance, BarcodeLabel } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionBarcodeIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', unit: '', barcode: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Product>(`/products/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchBalances = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api.get<{ data: InventoryBalance[] }>(`/inventory/balances/product/${id}`);
      setBalances(res.data || []);
    } catch (_) { setBalances([]); }
    finally { setSubLoading(false); }
  }, [id]);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await api.get<{ data: BarcodeLabel[] }>(`/barcodes/entities/PRODUCT/${id}/labels`);
      setLabels(res.data || []);
    } catch (_) { setLabels([]); }
  }, [id]);

  useEffect(() => { fetchData(); fetchBalances(); fetchLabels(); }, [fetchData, fetchBalances, fetchLabels]);

  const openEdit = () => {
    if (!data) return;
    setForm({ code: data.code, name: data.name, unit: data.unit, barcode: data.barcode || '' });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.unit) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch(`/products/${id}`, { code: form.code, name: form.name, unit: form.unit, barcode: form.barcode || undefined });
      showToast(t('common.successUpdated'), 'success');
      setEditOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    try { await api.patch(`/products/${id}`, { status: newStatus }); fetchData(); } catch (err: any) { showToast(err?.message, 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchBalances(); fetchLabels(); },
    edit: () => openEdit(),
    activate: () => handleStatusChange('ACTIVE'),
    deactivate: () => handleStatusChange('INACTIVE'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'balances', label: t('details.product.balances') },
    { id: 'labels', label: t('details.product.labels') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.category')}</dt><dd className="mt-1 text-sm text-gray-900">{data.category?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.unit')}</dt><dd className="mt-1 text-sm text-gray-900">{data.unit}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.barcode')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.barcode || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.minStock')}</dt><dd className="mt-1 text-sm text-gray-900">{data.minStock}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.maxStock')}</dt><dd className="mt-1 text-sm text-gray-900">{data.maxStock}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'balances' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.product.balances')}</h3></CardHeader>
          <CardContent>
            {subLoading ? <LoadingState /> : balances.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'warehouse', header: t('inventory.warehouse'), render: (b: InventoryBalance) => b.warehouse?.name || '-' },
                { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (b: InventoryBalance) => b.warehouseLocation?.name || '-' },
                { key: 'quantity', header: t('inventoryCounting.quantity'), render: (b: InventoryBalance) => b.quantity },
              ]} data={balances} keyExtractor={(b: InventoryBalance) => b.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'labels' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.product.labels')}</h3></CardHeader>
          <CardContent>
            {labels.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('barcodes.labelCode'), render: (l: BarcodeLabel) => l.code },
                { key: 'value', header: t('barcodes.labelValue'), render: (l: BarcodeLabel) => l.value },
                { key: 'symbology', header: t('barcodes.symbology'), render: (l: BarcodeLabel) => l.symbology },
                { key: 'status', header: t('common.status'), render: (l: BarcodeLabel) => <StatusBadge status={l.status} /> },
              ]} data={labels} keyExtractor={(l: BarcodeLabel) => l.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
