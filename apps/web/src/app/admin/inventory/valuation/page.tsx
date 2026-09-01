'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { getUserPermissions } from '../../../../lib/auth';
import {
  InventoryValuationPolicy,
  InventoryValuationReadiness,
  InventoryValuationInitialization,
  InventoryValuationReadyProduct,
  ValuationSourceLine,
  Product,
} from '../../../../lib/admin-types';
import { Button, Input, Textarea, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, warehouseAdapter } from '../../../../components/f9';

const POLICY_STATUS = 'DRAFT' as const;

function formatAmount(value: string | number | null | undefined, digits = 2): string {
  const n = value === null || value === undefined ? 0 : Number(value);
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export default function InventoryValuationPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const [canRead, setCanRead] = useState(false);
  const [canCostInput, setCanCostInput] = useState(false);
  const [canInitialize, setCanInitialize] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);

  const [policies, setPolicies] = useState<InventoryValuationPolicy[]>([]);
  const [policyMeta, setPolicyMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ warehouseId: '', currencyCode: '' });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [editCurrencyOpen, setEditCurrencyOpen] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [currencySaving, setCurrencySaving] = useState(false);

  const [beginConfirmOpen, setBeginConfirmOpen] = useState(false);
  const [beginSaving, setBeginSaving] = useState(false);

  const [readiness, setReadiness] = useState<InventoryValuationReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [productsByName, setProductsByName] = useState<Record<string, Product>>({});

  const [initModalOpen, setInitModalOpen] = useState(false);
  const [initProductId, setInitProductId] = useState('');
  const [initForm, setInitForm] = useState({ unitCost: '', reason: '' });
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});
  const [initSaving, setInitSaving] = useState(false);

  const [history, setHistory] = useState<InventoryValuationInitialization[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);

  const [costTab, setCostTab] = useState<'opening' | 'receipt'>('opening');
  const [sourceLines, setSourceLines] = useState<ValuationSourceLine[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [costLine, setCostLine] = useState<ValuationSourceLine | null>(null);
  const [costForm, setCostForm] = useState({ unitCost: '', reason: '' });
  const [costErrors, setCostErrors] = useState<Record<string, string>>({});
  const [costSaving, setCostSaving] = useState(false);

  const selectedPolicy = useMemo(() => policies.find((p) => p.id === selectedId) || null, [policies, selectedId]);

  useEffect(() => {
    getUserPermissions().then((res) => {
      setCanRead(res.permissions.includes('inventory-valuation:read') || res.isSuperAdmin);
      setCanCostInput(res.permissions.includes('inventory-valuation:cost-input') || res.isSuperAdmin);
      setCanInitialize(res.permissions.includes('inventory-valuation:initialize') || res.isSuperAdmin);
      setPermsLoaded(true);
    }).catch(() => setPermsLoaded(true));
  }, []);

  const fetchPolicies = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: InventoryValuationPolicy[]; meta: any }>('/inventory-valuation/policies', { params: { page, limit: 10 } });
      const list = unwrapApiList<InventoryValuationPolicy, any>(res);
      setPolicies(list.data);
      if (list.meta) setPolicyMeta(list.meta);
      if (selectedId && !list.data.some((p) => p.id === selectedId)) setSelectedId('');
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [selectedId, t]);

  useEffect(() => { if (canRead) fetchPolicies(); }, [canRead]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get<{ data: Product[]; meta: any }>('/products', { params: { limit: 1000 } });
      const list = unwrapApiList<Product, any>(res);
      const map: Record<string, Product> = {};
      list.data.forEach((p) => { map[p.id] = p; });
      setProductsByName(map);
    } catch { /* non-blocking */ }
  }, []);

  const fetchReadiness = useCallback(async (policyId: string) => {
    setReadinessLoading(true);
    try {
      const res = await api.get<InventoryValuationReadiness>(`/inventory-valuation/policies/${policyId}/readiness`);
      setReadiness(res);
      fetchProducts();
    } catch (err: any) { handleApiError(err); }
    finally { setReadinessLoading(false); }
  }, [handleApiError]);

  const fetchHistory = useCallback(async (warehouseId: string, page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await api.get<{ data: InventoryValuationInitialization[]; meta: any }>('/inventory-valuation/initializations', { params: { warehouseId, page, limit: 10 } });
      const list = unwrapApiList<InventoryValuationInitialization, any>(res);
      setHistory(list.data);
      if (list.meta) setHistoryMeta(list.meta);
    } catch (err: any) { handleApiError(err); }
    finally { setHistoryLoading(false); }
  }, [handleApiError]);

  const fetchSourceLines = useCallback(async (warehouseId: string, type: 'opening' | 'receipt') => {
    setSourceLoading(true);
    try {
      const isOpening = type === 'opening';
      const listRes = isOpening
        ? await api.get<{ data: any[]; meta: any }>('/inventory/opening-balances', { params: { warehouseId, limit: 20, page: 1 } })
        : await api.get<{ data: any[]; meta: any }>('/inventory/operational-receipts', { params: { warehouseId, limit: 20, page: 1 } });
      const docs = unwrapApiList<any, any>(listRes).data;
      const lines: ValuationSourceLine[] = [];
      await Promise.all(docs.map(async (doc) => {
        try {
          const detailRes = isOpening
            ? await api.get<any>(`/inventory/opening-balances/${doc.id}`)
            : await api.get<any>(`/inventory/operational-receipts/${doc.id}`);
          const detail = detailRes;
          (detail.lines || []).forEach((l: any) => {
            lines.push({
              lineId: l.id,
              productId: l.productId,
              productName: l.product?.name || '',
              productCode: l.product?.code || '',
              unit: l.product?.unit ?? null,
              quantity: l.quantity,
              unitCost: l.unitCost != null ? l.unitCost : null,
              currencyCode: l.currencyCode ?? null,
              valuationReason: l.valuationReason ?? null,
              sourceId: doc.id,
              sourceCode: detail.code || doc.code || '',
              sourceDocDate: detail.documentDate || doc.documentDate || null,
            });
          });
        } catch { /* skip doc that cannot be read */ }
      }));
      setSourceLines(lines.filter((l) => l.unitCost == null));
    } catch (err: any) { handleApiError(err); }
    finally { setSourceLoading(false); }
  }, [handleApiError]);

  const selectPolicy = (policy: InventoryValuationPolicy) => {
    setSelectedId(policy.id);
    fetchReadiness(policy.id);
    fetchHistory(policy.warehouseId, 1);
    fetchSourceLines(policy.warehouseId, costTab);
  };

  useEffect(() => {
    if (selectedPolicy && (selectedPolicy.status === 'DRAFT' || selectedPolicy.status === 'INITIALIZING')) {
      fetchSourceLines(selectedPolicy.warehouseId, costTab);
    }
  }, [costTab, selectedPolicy]);

  const handleCreatePolicy = async () => {
    const errs: Record<string, string> = {};
    if (!createForm.warehouseId) errs.warehouseId = t('inventoryValuation.warehouseRequired');
    if (!createForm.currencyCode.trim()) errs.currencyCode = t('inventoryValuation.currencyRequired');
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }
    setCreateErrors({}); setCreating(true);
    try {
      await api.post('/inventory-valuation/policies', {
        warehouseId: createForm.warehouseId,
        method: 'WEIGHTED_AVERAGE',
        currencyCode: createForm.currencyCode.trim(),
      });
      showToast(t('inventoryValuation.successCreated'), 'success');
      setCreateOpen(false);
      setCreateForm({ warehouseId: '', currencyCode: '' });
      await fetchPolicies(1);
    } catch (err: any) { handleApiError(err); }
    finally { setCreating(false); }
  };

  const handleSaveCurrency = async () => {
    if (!selectedPolicy) return;
    if (!currencyCode.trim()) { setCurrencyError(t('inventoryValuation.currencyRequired')); return; }
    setCurrencyError(''); setCurrencySaving(true);
    try {
      await api.patch(`/inventory-valuation/policies/${selectedPolicy.id}`, { currencyCode: currencyCode.trim() });
      showToast(t('inventoryValuation.successUpdated'), 'success');
      setEditCurrencyOpen(false);
      await fetchPolicies(policyMeta.page);
      fetchReadiness(selectedPolicy.id);
    } catch (err: any) { handleApiError(err); }
    finally { setCurrencySaving(false); }
  };

  const handleBeginInitialization = async () => {
    if (!selectedPolicy) return;
    setBeginSaving(true);
    try {
      await api.patch(`/inventory-valuation/policies/${selectedPolicy.id}/begin-initialization`);
      showToast(t('inventoryValuation.successInitializationStarted'), 'success');
      setBeginConfirmOpen(false);
      await fetchPolicies(policyMeta.page);
      fetchReadiness(selectedPolicy.id);
      fetchHistory(selectedPolicy.warehouseId, 1);
    } catch (err: any) { handleApiError(err); }
    finally { setBeginSaving(false); }
  };

  const openInitModal = (product: InventoryValuationReadyProduct) => {
    setInitProductId(product.productId);
    setInitForm({ unitCost: '', reason: '' });
    setInitErrors({});
    setInitModalOpen(true);
  };

  const handleInitialize = async () => {
    if (!selectedPolicy) return;
    const unitCost = Number(initForm.unitCost);
    const errs: Record<string, string> = {};
    if (initForm.unitCost === '' || !Number.isFinite(unitCost)) errs.unitCost = t('inventoryValuation.unitCostRequired');
    else if (unitCost < 0) errs.unitCost = t('inventoryValuation.negativeCost');
    if (unitCost === 0 && !initForm.reason.trim()) errs.reason = t('inventoryValuation.reasonRequiredForZero');
    if (Object.keys(errs).length) { setInitErrors(errs); return; }
    setInitErrors({}); setInitSaving(true);
    try {
      await api.post(`/inventory-valuation/policies/${selectedPolicy.id}/initialize`, {
        productId: initProductId,
        unitCost,
        reason: initForm.reason.trim() || undefined,
      });
      showToast(t('inventoryValuation.successInitialized'), 'success');
      setInitModalOpen(false);
      fetchReadiness(selectedPolicy.id);
      fetchHistory(selectedPolicy.warehouseId, 1);
    } catch (err: any) { handleApiError(err); }
    finally { setInitSaving(false); }
  };

  const openCostModal = (line: ValuationSourceLine) => {
    setCostLine(line);
    setCostForm({ unitCost: '', reason: '' });
    setCostErrors({});
  };

  const handleCostInput = async () => {
    if (!selectedPolicy || !costLine) return;
    const unitCost = Number(costForm.unitCost);
    const errs: Record<string, string> = {};
    if (costForm.unitCost === '' || !Number.isFinite(unitCost)) errs.unitCost = t('inventoryValuation.unitCostRequired');
    else if (unitCost < 0) errs.unitCost = t('inventoryValuation.negativeCost');
    if (unitCost === 0 && !costForm.reason.trim()) errs.reason = t('inventoryValuation.reasonRequiredForZero');
    if (Object.keys(errs).length) { setCostErrors(errs); return; }
    setCostErrors({}); setCostSaving(true);
    try {
      const payload = {
        lineId: costLine.lineId,
        unitCost,
        currencyCode: selectedPolicy.currencyCode,
        reason: costForm.reason.trim() || undefined,
      };
      if (costTab === 'opening') {
        await api.post(`/inventory-valuation/policies/${selectedPolicy.id}/opening-cost`, payload);
      } else {
        await api.post(`/inventory-valuation/policies/${selectedPolicy.id}/receipt-cost`, payload);
      }
      showToast(t('inventoryValuation.successCostInput'), 'success');
      setCostLine(null);
      fetchSourceLines(selectedPolicy.warehouseId, costTab);
    } catch (err: any) { handleApiError(err); }
    finally { setCostSaving(false); }
  };

  const currencyDisallowed = !!selectedPolicy && selectedPolicy.status !== 'DRAFT' && selectedPolicy.status !== 'INITIALIZING';

  if (!permsLoaded) {
    return <div><PageHeader title={t('inventoryValuation.title')} /> <LoadingState /></div>;
  }

  if (!canRead) {
    return (
      <div>
        <PageHeader title={t('inventoryValuation.title')} />
        <div className="text-center py-12">
          <p className="text-gray-500">{t('inventoryValuation.missingPermission')}</p>
        </div>
      </div>
    );
  }

  const columns: GridColumn<InventoryValuationPolicy>[] = [
    { key: 'warehouse', header: t('inventoryValuation.warehouse'), render: (r) => r.warehouse ? `[${r.warehouse.code}] ${r.warehouse.name}` : '-' },
    { key: 'method', header: t('inventoryValuation.method'), render: () => t('inventoryValuation.methodWeightedAverage') },
    { key: 'currencyCode', header: t('inventoryValuation.currency'), sortable: true },
    { key: 'status', header: t('inventoryValuation.status'), sortable: true, render: (r) => <StatusPill status={r.status} /> },
    { key: 'initialized', header: t('inventoryValuation.initialized'), align: 'center', render: (r) => r._count?.initializations ?? '-' },
    { key: 'createdAt', header: t('inventoryValuation.created'), render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-' },
  ];

  const initTarget = readiness?.missingProducts.find((m) => m.productId === initProductId) || null;

  return (
    <div>
      <PageHeader
        title={t('inventoryValuation.title')}
        subtitle={t('inventoryValuation.subtitle')}
        actions={canCostInput ? (
          <Button onClick={() => setCreateOpen(true)}>{t('inventoryValuation.createPolicy')}</Button>
        ) : <span className="text-sm text-gray-400">{t('inventoryValuation.readOnly')}</span>}
      />

      {error && (
        <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p></div>
      )}
      {!error && loading && policies.length === 0 && <LoadingState />}
      {!error && !loading && policies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('inventoryValuation.noPolicies')}</p>
          {canCostInput && (
            <div className="mt-4">
              <Button onClick={() => setCreateOpen(true)}>{t('inventoryValuation.createPolicy')}</Button>
            </div>
          )}
        </div>
      )}
      {(policies.length > 0) && (
        <AdminDataGrid
          columns={columns}
          data={policies}
          keyExtractor={(r) => r.id}
          onRowClick={selectPolicy}
          selectedKey={selectedId}
          loading={loading}
          emptyMessage={t('inventoryValuation.noPolicies')}
          error={error || undefined}
          dir={dir}
          onRefresh={() => fetchPolicies(policyMeta.page)}
          refreshLoading={loading}
        />
      )}
      {policies.length > 0 && (
        <div className="mt-3">
          <Pagination page={policyMeta.page} totalPages={policyMeta.totalPages} total={policyMeta.total} onPageChange={fetchPolicies} />
        </div>
      )}

      {!selectedPolicy && policies.length > 0 && (
        <div className="mt-6"><Card><div className="text-center py-10"><p className="text-gray-500">{t('inventoryValuation.noPolicySelected')}</p></div></Card></div>
      )}

      {selectedPolicy && (
        <div className="mt-6 space-y-6" data-policy-detail>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('inventoryValuation.policy')}</h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">{t('inventoryValuation.warehouse')}:</span> {selectedPolicy.warehouse ? `[${selectedPolicy.warehouse.code}] ${selectedPolicy.warehouse.name}` : '-'}</p>
                  <p><span className="font-medium">{t('inventoryValuation.method')}:</span> {t('inventoryValuation.methodWeightedAverage')}<span className="ms-2 text-xs text-gray-400">({selectedPolicy.method})</span></p>
                  <p><span className="font-medium">{t('inventoryValuation.currency')}:</span> <span dir="ltr">{selectedPolicy.currencyCode}</span>{selectedPolicy.status !== 'DRAFT' ? <span className="ms-2 text-xs text-gray-400">({t('inventoryValuation.currencyFrozen')})</span> : null}</p>
                  <p><span className="font-medium">{t('inventoryValuation.status')}:</span> <StatusPill status={selectedPolicy.status} /></p>
                  {selectedPolicy.initializedAt ? <p><span className="font-medium">{t('inventoryValuation.initialized')}:</span> {new Date(selectedPolicy.initializedAt).toLocaleString()}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPolicy.status === POLICY_STATUS && canCostInput && (
                  <>
                    <Button variant="secondary" onClick={() => { setCurrencyCode(selectedPolicy.currencyCode); setCurrencyError(''); setEditCurrencyOpen(true); }}>{t('inventoryValuation.currency')}</Button>
                    <Button onClick={() => setBeginConfirmOpen(true)}>{t('inventoryValuation.beginInitialization')}</Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {(selectedPolicy.status === 'DRAFT' || selectedPolicy.status === 'INITIALIZING') && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('inventoryValuation.foundation')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('inventoryValuation.foundationHint')}</p>
              {readinessLoading && (<LoadingState />)}
              {!readinessLoading && readiness && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <ReadinessCard label={t('inventoryValuation.productsWithStock')} value={readiness.productsWithStock} />
                    <ReadinessCard label={t('inventoryValuation.initializedCount')} value={readiness.initializedCount} />
                    <ReadinessCard label={t('inventoryValuation.missingCount')} value={readiness.missingCount} />
                    <ReadinessCard label={readiness.ready ? t('inventoryValuation.ready') : t('inventoryValuation.notReady')} value={readiness.ready ? '✓' : ''} ready={readiness.ready} />
                  </div>

                  <h4 className="font-medium text-gray-800 mb-2">{t('inventoryValuation.missingProducts')}</h4>
                  {readiness.missingProducts.length === 0 && (
                    <p className="text-sm text-gray-500">{t('inventoryValuation.noMissingProducts')}</p>
                  )}
                  {readiness.missingProducts.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left text-gray-600">
                            <th className="p-2">{t('inventoryValuation.product')}</th>
                            <th className="p-2 text-right">{t('inventoryValuation.quantitySnapshot')}</th>
                            {canInitialize && selectedPolicy.status === 'INITIALIZING' && <th className="p-2 text-center">{t('common.actions')}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {readiness.missingProducts.map((mp) => {
                            const product = productsByName[mp.productId] || null;
                            return (
                              <tr key={mp.productId} className="border-b hover:bg-gray-50">
                                <td className="p-2">{product ? `[${product.code}] ${product.name}` : '-'}</td>
                                <td className="p-2 text-right"><span dir="ltr">{formatAmount(mp.quantitySnapshot)}</span>{product?.unit ? ` ${product.unit}` : ''}</td>
                                {canInitialize && selectedPolicy.status === 'INITIALIZING' && (
                                  <td className="p-2 text-center">
                                    <Button variant="secondary" size="sm" onClick={() => openInitModal(mp)}>{t('inventoryValuation.initialize')}</Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {(selectedPolicy.status === 'DRAFT' || selectedPolicy.status === 'INITIALIZING') && canCostInput && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('inventoryValuation.monetaryInput')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('inventoryValuation.monetaryInputHint')}</p>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setCostTab('opening')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${costTab === 'opening' ? 'bg-[var(--ws-primary)] text-white' : 'bg-gray-100 text-gray-700'}`}>{t('inventoryValuation.openingBalances')}</button>
                <button onClick={() => setCostTab('receipt')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${costTab === 'receipt' ? 'bg-[var(--ws-primary)] text-white' : 'bg-gray-100 text-gray-700'}`}>{t('inventoryValuation.operationalReceipts')}</button>
              </div>
              {sourceLoading && (<LoadingState />)}
              {!sourceLoading && sourceLines.length === 0 && (
                <p className="text-sm text-gray-500">{t('inventoryValuation.noUnvaluedLines')}</p>
              )}
              {!sourceLoading && sourceLines.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-gray-600">
                        <th className="p-2">{t('inventoryValuation.document')}</th>
                        <th className="p-2">{t('inventoryValuation.product')}</th>
                        <th className="p-2 text-right">{t('inventoryValuation.quantity')}</th>
                        <th className="p-2 text-center">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceLines.map((line) => (
                        <tr key={line.lineId} className="border-b hover:bg-gray-50">
                          <td className="p-2"><span dir="ltr">{line.sourceCode || '-'}</span></td>
                          <td className="p-2">{line.productCode ? `[${line.productCode}] ${line.productName}` : line.productName || '-'}</td>
                          <td className="p-2 text-right"><span dir="ltr">{formatAmount(line.quantity)}</span>{line.unit ? ` ${line.unit}` : ''}</td>
                          <td className="p-2 text-center">
                            <Button variant="secondary" size="sm" onClick={() => openCostModal(line)}>{t('inventoryValuation.addValuationBasis')}</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{t('inventoryValuation.history')}</h3>
              {history.length > 0 && <Button variant="secondary" size="sm" onClick={() => fetchHistory(selectedPolicy.warehouseId, historyMeta.page)}>{t('common.refresh')}</Button>}
            </div>
            {historyLoading && (<LoadingState />)}
            {!historyLoading && history.length === 0 && <p className="text-sm text-gray-500">{t('inventoryValuation.noHistory')}</p>}
            {!historyLoading && history.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-gray-600">
                        <th className="p-2">{t('inventoryValuation.product')}</th>
                        <th className="p-2 text-right">{t('inventoryValuation.quantitySnapshot')}</th>
                        <th className="p-2 text-right">{t('inventoryValuation.unitCost')}</th>
                        <th className="p-2 text-right">{t('inventoryValuation.totalValue')}</th>
                        <th className="p-2 text-right">{t('inventoryValuation.currency')}</th>
                        <th className="p-2">{t('inventoryValuation.reason')}</th>
                        <th className="p-2">{t('inventoryValuation.created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{h.product ? `[${h.product.code}] ${h.product.name}` : '-'}</td>
                          <td className="p-2 text-right"><span dir="ltr">{formatAmount(h.quantitySnapshot)}</span></td>
                          <td className="p-2 text-right"><span dir="ltr">{formatAmount(h.unitCost)}</span></td>
                          <td className="p-2 text-right"><span dir="ltr">{formatAmount(h.totalValue)}</span></td>
                          <td className="p-2 text-right"><span dir="ltr">{h.currencyCode}</span></td>
                          <td className="p-2">{h.reason || '-'}</td>
                          <td className="p-2">{h.createdAt ? new Date(h.createdAt).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2">
                  <Pagination page={historyMeta.page} totalPages={historyMeta.totalPages} total={historyMeta.total} onPageChange={(p) => fetchHistory(selectedPolicy.warehouseId, p)} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('inventoryValuation.newPolicy')} size="lg">
        <div className="space-y-4">
          <div>
            <F9Lookup label={t('inventoryValuation.warehouse')} value={createForm.warehouseId} onChange={(v) => { setCreateForm((f) => ({ ...f, warehouseId: v || '' })); setCreateErrors((e) => ({ ...e, warehouseId: '' })); }} adapter={warehouseAdapter} />
            {createErrors.warehouseId && <p className="text-red-500 text-sm mt-1">{createErrors.warehouseId}</p>}
          </div>
          <div>
            <Input label={t('inventoryValuation.currency')} placeholder={t('inventoryValuation.currencyPlaceholder')} value={createForm.currencyCode} onChange={(e) => { setCreateForm((f) => ({ ...f, currencyCode: e.target.value })); setCreateErrors((er) => ({ ...er, currencyCode: '' })); }} />
            {createErrors.currencyCode && <p className="text-red-500 text-sm mt-1">{createErrors.currencyCode}</p>}
          </div>
          <div>
            <Input label={t('inventoryValuation.method')} value={t('inventoryValuation.methodWeightedAverage')} disabled />
            <p className="text-xs text-gray-500 mt-1">{t('inventoryValuation.methodReadOnly')}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-5">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('actions.cancel')}</Button>
          <Button onClick={handleCreatePolicy} loading={creating}>{t('actions.create')}</Button>
        </div>
      </Modal>

      <Modal open={editCurrencyOpen} onClose={() => setEditCurrencyOpen(false)} title={t('inventoryValuation.editPolicy')} size="md">
        <div className="space-y-4">
          <div>
            <Input label={t('inventoryValuation.currency')} placeholder={t('inventoryValuation.currencyPlaceholder')} value={currencyCode} onChange={(e) => { setCurrencyCode(e.target.value); setCurrencyError(''); }} disabled={currencyDisallowed} />
            {currencyError && <p className="text-red-500 text-sm mt-1">{currencyError}</p>}
            {currencyDisallowed && <p className="text-xs text-gray-500 mt-1">{t('inventoryValuation.currencyFrozen')}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-5">
          <Button variant="secondary" onClick={() => setEditCurrencyOpen(false)}>{t('actions.cancel')}</Button>
          <Button onClick={handleSaveCurrency} loading={currencySaving}>{t('actions.save')}</Button>
        </div>
      </Modal>

      <Modal open={initModalOpen} onClose={() => setInitModalOpen(false)} title={t('inventoryValuation.initializeProduct')} size="md">
        {initTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('inventoryValuation.product')}: {(() => { const p = productsByName[initTarget.productId]; return p ? `[${p.code}] ${p.name}` : '-'; })()}
            </p>
            <p className="text-sm text-gray-600">
              {t('inventoryValuation.quantitySnapshot')}: <span dir="ltr">{formatAmount(initTarget.quantitySnapshot)}</span>
            </p>
            <div>
              <Input label={t('inventoryValuation.unitCost')} type="number" step="any" min="0" value={initForm.unitCost} onChange={(e) => { setInitForm((f) => ({ ...f, unitCost: e.target.value })); setInitErrors((er) => ({ ...er, unitCost: '' })); }} />
              {initErrors.unitCost && <p className="text-red-500 text-sm mt-1">{initErrors.unitCost}</p>}
              {Number(initForm.unitCost) === 0 && <p className="text-xs text-amber-600 mt-1">{t('inventoryValuation.zeroCostHint')}</p>}
            </div>
            <div>
              <Textarea label={t('inventoryValuation.reason')} value={initForm.reason} onChange={(e) => { setInitForm((f) => ({ ...f, reason: e.target.value })); setInitErrors((er) => ({ ...er, reason: '' })); }} />
              {initErrors.reason && <p className="text-red-500 text-sm mt-1">{initErrors.reason}</p>}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-5">
          <Button variant="secondary" onClick={() => setInitModalOpen(false)}>{t('actions.cancel')}</Button>
          <Button onClick={handleInitialize} loading={initSaving}>{t('inventoryValuation.initialize')}</Button>
        </div>
      </Modal>

      <Modal open={costLine !== null} onClose={() => setCostLine(null)} title={t('inventoryValuation.setValuationCost')} size="md">
        {costLine && selectedPolicy && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('inventoryValuation.setCostFor')} &quot;{costLine.productCode ? `[${costLine.productCode}] ${costLine.productName}` : costLine.productName}&quot;</p>
            <p className="text-sm text-gray-600">{t('inventoryValuation.quantity')}: <span dir="ltr">{formatAmount(costLine.quantity)}</span></p>
            <p className="text-sm text-gray-600">{t('inventoryValuation.currency')}: <span dir="ltr">{selectedPolicy.currencyCode}</span></p>
            <div>
              <Input label={t('inventoryValuation.unitCost')} type="number" step="any" min="0" value={costForm.unitCost} onChange={(e) => { setCostForm((f) => ({ ...f, unitCost: e.target.value })); setCostErrors((er) => ({ ...er, unitCost: '' })); }} />
              {costErrors.unitCost && <p className="text-red-500 text-sm mt-1">{costErrors.unitCost}</p>}
              {Number(costForm.unitCost) === 0 && <p className="text-xs text-amber-600 mt-1">{t('inventoryValuation.zeroCostHint')}</p>}
            </div>
            <div>
              <Textarea label={t('inventoryValuation.reason')} value={costForm.reason} onChange={(e) => { setCostForm((f) => ({ ...f, reason: e.target.value })); setCostErrors((er) => ({ ...er, reason: '' })); }} />
              {costErrors.reason && <p className="text-red-500 text-sm mt-1">{costErrors.reason}</p>}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-5">
          <Button variant="secondary" onClick={() => setCostLine(null)}>{t('actions.cancel')}</Button>
          <Button onClick={handleCostInput} loading={costSaving}>{t('inventoryValuation.setValuationCost')}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={beginConfirmOpen}
        onClose={() => setBeginConfirmOpen(false)}
        onConfirm={handleBeginInitialization}
        title={t('inventoryValuation.beginInitialization')}
        message={t('inventoryValuation.beginInitializationConfirm')}
        variant="primary"
        loading={beginSaving}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const label = t(`status.${status}`) !== `status.${status}` ? t(`status.${status}`) : status;
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    INITIALIZING: 'bg-sky-100 text-sky-800',
    ACTIVE: 'bg-green-100 text-green-800',
    RETIRED: 'bg-gray-200 text-gray-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>{label}</span>;
}

function ReadinessCard({ label, value, ready }: { label: string; value: string | number; ready?: boolean }) {
  return (
    <div className={`bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg p-3 ${ready ? 'ring-1 ring-green-200' : ''}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900" dir="ltr">{value || '–'}</p>
    </div>
  );
}
