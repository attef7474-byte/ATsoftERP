'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine } from '../../../../../../lib/admin-types';
import { Button, Input, Card, CardHeader, CardContent, DataTable, LoadingState, ErrorState, EmptyState, Modal, ConfirmDialog } from '../../../../../../components/admin/ui';
import { F9Lookup, productAdapter, warehouseLocationAdapter } from '../../../../../../components/f9';
import { InventoryStatusBadge, QuantityDifferenceBadge } from '../../../../../../components/inventory-counting/InventoryStatusBadge';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionBarcodeIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountExecutePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scanValue, setScanValue] = useState('');
  const [scanning, setScanning] = useState(false);

  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', warehouseLocationId: '', notes: '' });

  const [countModalOpen, setCountModalOpen] = useState(false);
  const [countLineId, setCountLineId] = useState('');
  const [countLineSystemQty, setCountLineSystemQty] = useState(0);
  const [countedQty, setCountedQty] = useState('');
  const [countSaving, setCountSaving] = useState(false);

  const [verifyConfirmOpen, setVerifyConfirmOpen] = useState(false);
  const [verifyLineId, setVerifyLineId] = useState('');
  const [verifySaving, setVerifySaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [countRes, linesRes] = await Promise.all([
        api.get<InventoryCount>(`/inventory/counts/${id}`),
        api.get<{ data: InventoryCountLine[] }>(`/inventory/counts/${id}/lines`),
      ]);
      setCount(countRes);
      setLines(linesRes.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleScan = async () => {
    if (!scanValue.trim() || !count) return;
    setScanning(true);
    try {
      const result = await api.post<any>('/barcodes/scan', { value: scanValue.trim(), purpose: 'INVENTORY_COUNTING' });
      const productId = result?.label?.entityId || result?.entityId;
      if (!productId) { showToast(t('inventoryCountWorkflow.barcodeNotFound'), 'error'); return; }
      await api.post(`/inventory/counts/${id}/lines`, { productId });
      showToast(t('inventoryCountWorkflow.productAddedToCount'), 'success');
      setScanValue('');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('inventoryCountWorkflow.barcodeNotFound'), 'error'); }
    finally { setScanning(false); scanInputRef.current?.focus(); }
  };

  const handleAddLine = async () => {
    if (!lineForm.productId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { productId: lineForm.productId, notes: lineForm.notes || undefined };
      if (lineForm.warehouseLocationId) payload.warehouseLocationId = lineForm.warehouseLocationId;
      await api.post(`/inventory/counts/${id}/lines`, payload);
      showToast(t('inventoryCountWorkflow.productAddedToCount'), 'success');
      setLineModalOpen(false);
      setLineForm({ productId: '', warehouseLocationId: '', notes: '' });
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const openCountModal = (line: InventoryCountLine) => {
    setCountLineId(line.id);
    setCountLineSystemQty(line.systemQty);
    setCountedQty(line.countedQty != null ? String(line.countedQty) : '');
    setCountModalOpen(true);
  };

  const handleCount = async () => {
    const qty = parseFloat(countedQty);
    if (isNaN(qty)) { showToast(t('validation.required'), 'error'); return; }
    setCountSaving(true);
    try {
      await api.patch(`/inventory/count-lines/${countLineId}/count`, { countedQty: qty });
      showToast(t('inventoryCountWorkflow.countLineRecorded'), 'success');
      setCountModalOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setCountSaving(false); }
  };

  const openVerifyConfirm = (lineId: string) => { setVerifyLineId(lineId); setVerifyConfirmOpen(true); };

  const handleVerify = async () => {
    setVerifySaving(true);
    try {
      await api.patch(`/inventory/count-lines/${verifyLineId}/verify`);
      showToast(t('inventoryCountWorkflow.countLineVerified'), 'success');
      setVerifyConfirmOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setVerifySaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    scan: () => handleScan(),
    addLine: () => { setLineForm({ productId: '', warehouseLocationId: '', notes: '' }); setLineModalOpen(true); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'scan', labelKey: 'inventoryCountWorkflow.scanBarcode', icon: <ActionBarcodeIcon />, onClick: () => exec('scan'), enabled: !!scanValue.trim() },
    { id: 'addLine', labelKey: 'inventoryCountWorkflow.executeActionAddLine', icon: <ActionAddIcon />, onClick: () => exec('addLine') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!count) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const isInProgress = count.status === 'IN_PROGRESS';
  const isDraft = count.status === 'DRAFT';
  const canCount = isDraft || isInProgress;

  const summary = count.summary || { linesCount: 0, countedLinesCount: 0, verifiedLinesCount: 0, totalDifferenceQty: 0 };

  const columns = [
    { key: 'product', header: t('inventoryCounting.product'), render: (r: InventoryCountLine) => r.product ? `${r.product.code} - ${r.product.name}` : '-' },
    { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (r: InventoryCountLine) => r.warehouseLocation?.name || '-' },
    { key: 'systemQty', header: t('inventoryCounting.systemQty'), render: (r: InventoryCountLine) => r.systemQty },
    { key: 'countedQty', header: t('inventoryCounting.countedQty'), render: (r: InventoryCountLine) => r.countedQty ?? '-' },
    { key: 'differenceQty', header: t('inventoryCounting.differenceQty'), render: (r: InventoryCountLine) => r.differenceQty != null ? <QuantityDifferenceBadge diff={r.differenceQty} /> : '-' },
    { key: 'status', header: t('common.status'), render: (r: InventoryCountLine) => <InventoryStatusBadge status={r.status} /> },
    { key: 'actions', header: t('common.actions'), render: (r: InventoryCountLine) => (
      <div className="flex gap-2 flex-wrap">
        {(r.status === 'PENDING' || r.status === 'COUNTED') && canCount && (
          <button onClick={() => openCountModal(r)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('inventoryCountWorkflow.executeActionRecordCount')}</button>
        )}
        {r.status === 'COUNTED' && (
          <button onClick={() => openVerifyConfirm(r.id)} className="text-emerald-600 hover:text-emerald-800 text-sm">{t('inventoryCountWorkflow.executeActionVerify')}</button>
        )}
      </div>
    ),
    },
  ];

  const locationFilters = count.warehouseId ? { warehouseId: count.warehouseId } : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalLines')}</p><p className="text-xl font-bold">{summary.linesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.countedLines')}</p><p className="text-xl font-bold text-blue-600">{summary.countedLinesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.verifiedLines')}</p><p className="text-xl font-bold text-green-600">{summary.verifiedLinesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalDifference')}</p><p className="text-xl font-bold text-orange-600">{summary.totalDifferenceQty}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.scanBarcode')}</h3></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <input ref={scanInputRef} type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder={t('inventoryCountWorkflow.scanPlaceholder')}
                className="block w-full rounded-lg border-2 border-blue-400 px-4 py-2 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <Button onClick={handleScan} loading={scanning} disabled={!scanValue.trim()}>{t('inventoryCountWorkflow.scanBarcode')}</Button>
            <Button variant="secondary" onClick={() => { setLineForm({ productId: '', warehouseLocationId: '', notes: '' }); setLineModalOpen(true); }}>{t('inventoryCountWorkflow.manualAdd')}</Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('inventoryCountWorkflow.executeNote')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.countLines')}</h3></CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? <EmptyState message={t('common.noData')} /> : (
            <DataTable columns={columns} data={lines} keyExtractor={(r: InventoryCountLine) => r.id} />
          )}
        </CardContent>
      </Card>

      <Modal open={lineModalOpen} onClose={() => setLineModalOpen(false)} title={t('inventoryCountWorkflow.manualAdd')} size="md">
        <div className="space-y-4">
          <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
          {count.warehouseId && (
            <F9Lookup label={t('inventoryCounting.warehouseLocation')} value={lineForm.warehouseLocationId} onChange={(v) => setLineForm({ ...lineForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} filters={locationFilters} />
          )}
          <Input label={t('common.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setLineModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleAddLine} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={countModalOpen} onClose={() => setCountModalOpen(false)} title={t('inventoryCountWorkflow.executeActionRecordCount')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('inventoryCounting.systemQty')}: <strong>{countLineSystemQty}</strong></p>
          <Input label={t('inventoryCounting.countedQty')} type="number" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCountModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleCount} loading={countSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={verifyConfirmOpen} onClose={() => setVerifyConfirmOpen(false)} onConfirm={handleVerify}
        title={t('common.confirm')} message={t('inventoryCounting.confirmVerifyLine')} variant="primary" loading={verifySaving} />
    </div>
  );
}
