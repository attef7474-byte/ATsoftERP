'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';
import {
  ProductionMaterialRequirement,
  ProductionMaterialReadiness,
  ProductionMaterialConsumption,
  ProductionConsumptionSummary,
  ProductionMaterialTraceability,
} from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productionOrderAdapter, productionRunAdapter, productAdapter } from '../../../../components/f9/lookup-adapters';
import { RequirementLinesEditor, RequirementLineDraft, createEmptyRequirementLine } from './_components/lines-editor';

type Tab = 'consumption' | 'traceability' | 'history';

interface RecordForm {
  requirementLineId: string;
  productionRunId: string;
  productId: string;
  unit: string;
  quantity: string;
  sourceDocumentNumber: string;
  sourceDocumentType: string;
  notes: string;
}

interface CorrectForm {
  newQuantity: string;
  reason: string;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export default function ProductionMaterialRequirementsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-material-requirement:' + action)),
    [isSuperAdmin, permissions],
  );
  const canConsume = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-material-consumption:' + action)),
    [isSuperAdmin, permissions],
  );
  const canTrace = useCallback(
    () => isSuperAdmin || Boolean(permissions?.permissions.includes('production-traceability:read')),
    [isSuperAdmin, permissions],
  );

  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [requirement, setRequirement] = useState<ProductionMaterialRequirement | null>(null);
  const [readiness, setReadiness] = useState<ProductionMaterialReadiness | null>(null);
  const [consumption, setConsumption] = useState<ProductionConsumptionSummary | null>(null);
  const [traceability, setTraceability] = useState<ProductionMaterialTraceability | null>(null);
  const [history, setHistory] = useState<ProductionMaterialConsumption[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const [tab, setTab] = useState<Tab>('consumption');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formLines, setFormLines] = useState<RequirementLineDraft[]>([]);
  const [formNotes, setFormNotes] = useState('');

  const [freezeConfirm, setFreezeConfirm] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>({
    requirementLineId: '',
    productionRunId: '',
    productId: '',
    unit: '',
    quantity: '',
    sourceDocumentNumber: '',
    sourceDocumentType: '',
    notes: '',
  });

  const [correctTarget, setCorrectTarget] = useState<ProductionMaterialConsumption | null>(null);
  const [correctForm, setCorrectForm] = useState<CorrectForm>({ newQuantity: '', reason: '' });

  const snapshotLines = useMemo(() => (requirement?.status === 'FROZEN' ? requirement.lines : []), [requirement]);

  const resetForm = () => {
    setFormLines([createEmptyRequirementLine()]);
    setFormNotes('');
    setValidationErrors({});
  };

  const loadAll = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const [reqRes, readinessRes, consumptionRes, historyRes] = await Promise.all([
        api.get<{ data: ProductionMaterialRequirement }>(`/production/orders/${id}/material-requirements`).catch(() => ({ data: null as unknown as ProductionMaterialRequirement })),
        api.get<{ data: ProductionMaterialReadiness }>(`/production/orders/${id}/material-readiness`),
        api.get<{ data: ProductionConsumptionSummary }>(`/production/orders/${id}/material-consumption`),
        api.get<{ data: ProductionMaterialConsumption[]; meta: any }>(`/production/orders/${id}/consumption-history`, { params: { page: 1, limit: 10 } }),
      ]);
      setRequirement(reqRes.data);
      setReadiness(readinessRes.data);
      setConsumption(consumptionRes.data);
      setHistory(historyRes.data || []);
      setHistoryMeta(historyRes.meta || { page: 1, limit: 10, total: 0, totalPages: 0 });
      if (canTrace()) {
        const traceRes = await api.get<{ data: ProductionMaterialTraceability }>(`/production/orders/${id}/traceability`);
        setTraceability(traceRes.data);
      } else {
        setTraceability(null);
      }
    } catch (err: any) {
      setError(err?.message || t('production.materialRequirements.loadFailed'));
      setRequirement(null);
      setReadiness(null);
      setConsumption(null);
      setTraceability(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [canTrace, t]);

  const { exec } = useStableHandlers({
    refresh: () => { if (orderId) void loadAll(orderId); },
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh'), enabled: Boolean(orderId) },
  ]);

  useEffect(() => {
    if (!orderId) {
      setRequirement(null);
      setReadiness(null);
      setConsumption(null);
      setTraceability(null);
      setHistory([]);
      return;
    }
    resetForm();
    void loadAll(orderId);
  }, [orderId, loadAll]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionMaterialRequirement.')) {
      handleApiError(err, { message: t('production.materialRequirements.errors.' + key.slice('productionMaterialRequirement.'.length)) });
      return;
    }
    if (key && key.startsWith('productionMaterial.')) {
      handleApiError(err, { message: t('production.materialRequirements.errors.' + key.slice('productionMaterial.'.length)) });
      return;
    }
    if (key && key.startsWith('productionTraceability.')) {
      handleApiError(err, { message: t('production.materialRequirements.errors.' + key.slice('productionTraceability.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const linesToPayload = (lines: RequirementLineDraft[]) => lines.map((line) => ({
    productId: line.productId,
    plannedQuantityPerUnit: toNumber(line.plannedQuantityPerUnit),
    baseUnit: line.baseUnit.trim(),
    issueUnit: line.issueUnit.trim(),
    conversionFactor: line.conversionFactor ? toNumber(line.conversionFactor) : undefined,
    componentRole: line.componentRole || undefined,
    warehouseId: line.warehouseId || undefined,
    overIssuePolicy: line.overIssuePolicy || undefined,
    tolerancePercent: line.overIssuePolicy === 'TOLERANCE' && line.tolerancePercent ? toNumber(line.tolerancePercent) : undefined,
    notes: line.notes.trim() || undefined,
  }));

  const validateLines = (): boolean => {
    const errors: Record<string, string> = {};
    if (formLines.length === 0) {
      errors.lines = t('production.materialRequirements.errors.linesRequired');
      setValidationErrors(errors);
      return false;
    }
    const products = new Set<string>();
    const lineErrors: string[] = [];
    for (const line of formLines) {
      if (!line.productId) lineErrors.push(t('production.materialRequirements.errors.productRequired'));
      if (products.has(line.productId)) lineErrors.push(t('production.materialRequirements.errors.duplicateProduct'));
      products.add(line.productId);
      if (!line.plannedQuantityPerUnit || toNumber(line.plannedQuantityPerUnit) <= 0) lineErrors.push(t('production.materialRequirements.errors.productRequired'));
      if (!line.baseUnit.trim()) lineErrors.push(t('production.materialRequirements.errors.productRequired'));
      if (!line.issueUnit.trim()) lineErrors.push(t('production.materialRequirements.errors.productRequired'));
      if (line.overIssuePolicy === 'TOLERANCE' && (!line.tolerancePercent || toNumber(line.tolerancePercent) < 0)) {
        lineErrors.push(t('production.materialRequirements.errors.toleranceRequired'));
      }
    }
    if (lineErrors.length > 0 && !errors.lines) errors.lines = lineErrors[0];
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openPrepare = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = () => {
    if (!requirement) return;
    setFormLines((requirement.lines || []).map((line) => ({
      key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      productId: line.productId,
      plannedQuantityPerUnit: String(line.plannedQuantityPerUnit),
      baseUnit: line.baseUnit,
      issueUnit: line.issueUnit,
      conversionFactor: line.conversionFactor ? String(line.conversionFactor) : '1',
      componentRole: line.componentRole || 'RAW_MATERIAL',
      warehouseId: line.warehouseId || '',
      overIssuePolicy: line.overIssuePolicy || 'NOT_ALLOWED',
      tolerancePercent: line.tolerancePercent ? String(line.tolerancePercent) : '',
      productionStage: line.productionStage || '',
      lotControlRequired: line.lotControlRequired,
      notes: line.notes || '',
    })));
    setFormNotes(requirement.notes || '');
    setValidationErrors({});
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    if (!validateLines()) return;
    if (!orderId) return;
    setSaving(true);
    try {
      const payload: any = {
        notes: formNotes.trim() || undefined,
        lines: linesToPayload(formLines),
      };
      if (requirement) {
        await api.patch(`/production/material-requirements/${requirement.id}`, payload);
      } else {
        payload.requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        await api.post(`/production/orders/${orderId}/material-requirements`, payload);
      }
      showToast(t('common.saved'), 'success');
      setShowForm(false);
      await loadAll(orderId);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleFreeze = async () => {
    if (!requirement) return;
    setSaving(true);
    try {
      await api.patch(`/production/material-requirements/${requirement.id}/freeze`);
      showToast(t('common.saved'), 'success');
      setFreezeConfirm(false);
      await loadAll(orderId);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!requirement) return;
    if (!cancelReason.trim()) {
      setValidationErrors({ cancelReason: t('production.materialRequirements.cancelReasonRequired') });
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/production/material-requirements/${requirement.id}/cancel`, { reason: cancelReason.trim() });
      showToast(t('common.saved'), 'success');
      setCancelOpen(false);
      setCancelReason('');
      setValidationErrors({});
      await loadAll(orderId);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const openRecord = () => {
    setRecordForm({
      requirementLineId: '',
      productionRunId: '',
      productId: '',
      unit: '',
      quantity: '',
      sourceDocumentNumber: '',
      sourceDocumentType: '',
      notes: '',
    });
    setValidationErrors({});
    setRecordOpen(true);
  };

  const handleRecord = async () => {
    const errors: Record<string, string> = {};
    if (!recordForm.productId) errors.productId = t('production.materialRequirements.errors.productRequired');
    if (!recordForm.unit.trim()) errors.unit = t('production.materialRequirements.errors.productRequired');
    if (!recordForm.quantity || toNumber(recordForm.quantity) <= 0) errors.quantity = t('production.materialRequirements.errors.productRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        productionOrderId: orderId,
        productionRunId: recordForm.productionRunId || undefined,
        requirementLineId: recordForm.requirementLineId || undefined,
        productId: recordForm.productId,
        unit: recordForm.unit.trim(),
        quantity: toNumber(recordForm.quantity),
        sourceDocumentNumber: recordForm.sourceDocumentNumber.trim() || undefined,
        sourceDocumentType: recordForm.sourceDocumentType.trim() || undefined,
        requestId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        notes: recordForm.notes.trim() || undefined,
      };
      await api.post('/production/material-consumptions', payload);
      showToast(t('common.saved'), 'success');
      setRecordOpen(false);
      await loadAll(orderId);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const openCorrect = (record: ProductionMaterialConsumption) => {
    setCorrectTarget(record);
    setCorrectForm({ newQuantity: String(record.quantity), reason: '' });
    setValidationErrors({});
  };

  const handleCorrect = async () => {
    if (!correctTarget) return;
    const errors: Record<string, string> = {};
    if (!correctForm.newQuantity || toNumber(correctForm.newQuantity) <= 0) errors.newQuantity = t('production.materialRequirements.errors.productRequired');
    if (!correctForm.reason.trim()) errors.reason = t('production.materialRequirements.errors.productRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/production/material-consumptions/${correctTarget.id}/correct`, {
        newQuantity: toNumber(correctForm.newQuantity),
        reason: correctForm.reason.trim(),
      });
      showToast(t('common.saved'), 'success');
      setCorrectTarget(null);
      await loadAll(orderId);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const loadHistoryPage = async (page: number) => {
    try {
      const res = await api.get<{ data: ProductionMaterialConsumption[]; meta: any }>(`/production/orders/${orderId}/consumption-history`, { params: { page, limit: 10 } });
      setHistory(res.data || []);
      setHistoryMeta(res.meta || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (err) { handleApiError(err); }
  };

  const statusClass = (value: string) => {
    if (value === 'FROZEN' || value === 'READY' || value === 'OK') return 'bg-green-100 text-green-800';
    if (value === 'DRAFT' || value === 'SHORT') return 'bg-yellow-100 text-yellow-800';
    if (value === 'CANCELLED') return 'bg-gray-100 text-gray-600';
    if (value === 'OVER_ISSUE' || value === 'NOT_READY') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const blockReason = (code: string) => {
    if (code.startsWith('productionMaterialRequirement.')) {
      return t('production.materialRequirements.errors.' + code.slice('productionMaterialRequirement.'.length));
    }
    return code;
  };

  const warningLabel = (code: string) => {
    if (code.startsWith('productionMaterialRequirement.')) {
      return t('production.materialRequirements.errors.' + code.slice('productionMaterialRequirement.'.length));
    }
    return code;
  };

  const recordLineOptions = snapshotLines.map((line) => ({
    value: line.id,
    label: `[${line.productCodeSnapshot}] ${line.productNameSnapshot}`,
  }));

  return (
    <div>
      <PageHeader title={t('production.materialRequirements.title')} />
      <p className="mb-4 text-sm text-gray-500">{t('production.materialRequirements.subtitle')}</p>

      <div className="mb-4 max-w-2xl">
        <F9Lookup
          label={t('production.materialRequirements.selectOrder')}
          value={orderId}
          adapter={productionOrderAdapter}
          onChange={setOrderId}
          clearOnContextChange={false}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {orderId && loading && <p className="py-6 text-sm text-gray-500">{t('common.loading')}</p>}

      {orderId && !loading && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">{t('production.materialRequirements.snapshot')}</h2>
                {requirement && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(requirement.status)}`}>
                    {t('production.materialRequirements.status' + requirement.status)}
                  </span>
                )}
              </div>
              {can('prepare') && (
                <div className="flex flex-wrap gap-2">
                  {!requirement && (
                    <Button size="sm" onClick={openPrepare}>{t('production.materialRequirements.prepare')}</Button>
                  )}
                  {requirement && requirement.status === 'DRAFT' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={openEdit}>{t('production.materialRequirements.update')}</Button>
                      <Button size="sm" onClick={() => setFreezeConfirm(true)}>{t('production.materialRequirements.freeze')}</Button>
                    </>
                  )}
                  {can('cancel') && requirement && (requirement.status === 'DRAFT' || requirement.status === 'FROZEN') && (
                    <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>{t('production.materialRequirements.cancel')}</Button>
                  )}
                </div>
              )}
            </div>

            {!requirement ? (
              <p className="text-sm text-gray-500">{t('production.materialRequirements.noSnapshot')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">{t('production.materialRequirements.revision')}</p>
                  <p className="mt-1 font-medium" dir="ltr">{requirement.revision}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('production.materialRequirements.preparedAt')}</p>
                  <p className="mt-1 font-medium" dir="ltr">{new Date(requirement.preparedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('production.materialRequirements.frozenAt')}</p>
                  <p className="mt-1 font-medium" dir="ltr">{requirement.frozenAt ? new Date(requirement.frozenAt).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('production.materialRequirements.notes')}</p>
                  <p className="mt-1">{requirement.notes || '-'}</p>
                </div>
              </div>
            )}
          </div>

          {readiness && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">{t('production.materialRequirements.readiness')}</h2>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(readiness.status)}`}>
                  {readiness.status === 'READY' ? t('production.materialRequirements.ready') : t('production.materialRequirements.notReady')}
                </span>
              </div>
              {readiness.blockers.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-red-700">{t('production.materialRequirements.blockers')}</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-red-600">
                    {readiness.blockers.map((code) => <li key={code}>{blockReason(code)}</li>)}
                  </ul>
                </div>
              )}
              {readiness.warnings.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-yellow-700">{t('production.materialRequirements.warningsTitle')}</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-yellow-600">
                    {readiness.warnings.map((code) => <li key={code}>{warningLabel(code)}</li>)}
                  </ul>
                </div>
              )}
              {readiness.lines.length === 0 ? (
                <p className="text-sm text-gray-500">{t('production.materialRequirements.noLines')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                        <th className="px-2 py-2">{t('production.materialRequirements.product')}</th>
                        <th className="px-2 py-2">{t('production.materialRequirements.plannedQuantity')}</th>
                        <th className="px-2 py-2">{t('production.materialRequirements.issueUnit')}</th>
                        <th className="px-2 py-2">{t('production.materialRequirements.netIssued')}</th>
                        <th className="px-2 py-2">{t('production.materialRequirements.shortage')}</th>
                        <th className="px-2 py-2">{t('production.materialRequirements.lineStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readiness.lines.map((line) => (
                        <tr key={line.lineId} className="border-b border-gray-100">
                          <td className="px-2 py-2">
                            <span className="font-medium">[{line.productCode || '-'}]</span> {line.productName || '-'}
                          </td>
                          <td className="px-2 py-2" dir="ltr">{line.plannedQuantity}</td>
                          <td className="px-2 py-2">{line.issueUnit}</td>
                          <td className="px-2 py-2" dir="ltr">{line.netIssued}</td>
                          <td className="px-2 py-2" dir="ltr">{line.shortage}</td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(line.status)}`}>
                              {t('production.materialRequirements.lineStatus' + line.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex gap-4">
                {(['consumption', 'traceability', 'history'] as Tab[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`text-sm font-medium ${tab === item ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {t('production.materialRequirements.' + item)}
                  </button>
                ))}
              </div>
              {tab === 'consumption' && canConsume('record') && requirement?.status === 'FROZEN' && (
                <Button size="sm" onClick={openRecord}>{t('production.materialRequirements.recordConsumption')}</Button>
              )}
            </div>

            {tab === 'consumption' && (
              <div>
                {consumption && (
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs text-gray-500">{t('production.materialRequirements.source')}:</span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {t('production.materialRequirements.source' + consumption.source)}
                    </span>
                  </div>
                )}
                {consumption?.warnings && consumption.warnings.length > 0 && (
                  <ul className="mb-3 list-inside list-disc space-y-0.5 text-sm text-yellow-600">
                    {consumption.warnings.map((code) => <li key={code}>{warningLabel(code)}</li>)}
                  </ul>
                )}
                <p className="mb-3 text-xs text-gray-500">{t('production.materialRequirements.consumptionFact')}</p>
                {consumption && consumption.lines.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('production.materialRequirements.historyEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                          <th className="px-2 py-2">{t('production.materialRequirements.product')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.unit')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.consumed')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.plannedQuantity')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(consumption?.lines || []).map((line, index) => (
                          <tr key={line.productId + '-' + index} className="border-b border-gray-100">
                            <td className="px-2 py-2">
                              <span className="font-medium">[{line.productCode || '-'}]</span> {line.productName || '-'}
                            </td>
                            <td className="px-2 py-2">{line.unit || '-'}</td>
                            <td className="px-2 py-2" dir="ltr">{line.consumedQuantity}</td>
                            <td className="px-2 py-2" dir="ltr">{line.plannedQuantity ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'traceability' && (
              <div className="space-y-4">
                {traceability?.snapshot && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-gray-500">{t('production.materialRequirements.snapshot')}</p>
                    <p className="text-sm text-gray-600">
                      {t('production.materialRequirements.revision')}: <span dir="ltr">{traceability.snapshot.revision}</span> &middot;{' '}
                      {t('production.materialRequirements.status')}: {t('production.materialRequirements.status' + traceability.snapshot.status)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-500">{t('production.materialRequirements.documents')}</p>
                  {traceability?.documents && traceability.documents.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('production.materialRequirements.noHistory')}</p>
                  ) : (
                    <div className="space-y-3">
                      {(traceability?.documents || []).map((doc) => (
                        <div key={doc.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-2 flex flex-wrap gap-3 text-xs text-gray-600">
                            <span className="font-medium" dir="ltr">{doc.documentNumber}</span>
                            <span>{t('production.finishedGoodsReceipts.documentType')}: {doc.documentType}</span>
                            <span>{t('production.materialRequirements.run')}: {doc.productionRun?.runNumber || '-'}</span>
                            <span>{t('production.materialRequirements.movementNumber')}: {doc.movement?.movementNumber || '-'}</span>
                            <span dir="ltr">{new Date(doc.documentDate).toLocaleDateString()}</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                                <th className="px-2 py-1">{t('production.materialRequirements.product')}</th>
                                <th className="px-2 py-1">{t('production.materialRequirements.quantity')}</th>
                                <th className="px-2 py-1">{t('production.materialRequirements.lossEvent')}</th>
                                <th className="px-2 py-1">{t('production.materialRequirements.reverses')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.lines.map((line) => (
                                <tr key={line.id} className="border-b border-gray-100">
                                  <td className="px-2 py-1">
                                    <span className="font-medium">[{line.product?.code || line.productCodeSnapshot}]</span> {line.product?.name || line.productNameSnapshot}
                                  </td>
                                  <td className="px-2 py-1" dir="ltr">{line.quantity} {line.unit}</td>
                                  <td className="px-2 py-1">{line.lossQuantityEvent ? `${line.lossQuantityEvent.eventNumber} (${line.lossQuantityEvent.lossType})` : '-'}</td>
                                  <td className="px-2 py-1">{line.originalIssueLine ? `#${line.originalIssueLine.lineNumber}` : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-500">{t('production.materialRequirements.consumptionRecords')}</p>
                  {traceability?.consumptionRecords && traceability.consumptionRecords.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('production.materialRequirements.historyEmpty')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                            <th className="px-2 py-1">{t('production.materialRequirements.product')}</th>
                            <th className="px-2 py-1">{t('production.materialRequirements.quantity')}</th>
                            <th className="px-2 py-1">{t('production.materialRequirements.unit')}</th>
                            <th className="px-2 py-1">{t('production.materialRequirements.recordedAt')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(traceability?.consumptionRecords || []).map((record) => (
                            <tr key={record.id} className="border-b border-gray-100">
                              <td className="px-2 py-1">
                                <span className="font-medium">[{record.product?.code || record.productCodeSnapshot}]</span> {record.product?.name || record.productNameSnapshot}
                              </td>
                              <td className="px-2 py-1" dir="ltr">{record.quantity}</td>
                              <td className="px-2 py-1">{record.unit}</td>
                              <td className="px-2 py-1" dir="ltr">{new Date(record.recordedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('production.materialRequirements.historyEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                          <th className="px-2 py-2">{t('production.materialRequirements.product')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.quantity')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.unit')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.sourceDocument')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.recordedAt')}</th>
                          <th className="px-2 py-2">{t('production.materialRequirements.recordedBy')}</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((record) => (
                          <tr key={record.id} className="border-b border-gray-100">
                            <td className="px-2 py-2">
                              <span className="font-medium">[{record.product?.code || record.productCodeSnapshot}]</span> {record.product?.name || record.productNameSnapshot}
                            </td>
                            <td className="px-2 py-2" dir="ltr">{record.quantity}</td>
                            <td className="px-2 py-2">{record.unit}</td>
                            <td className="px-2 py-2">{record.sourceDocumentNumber || '-'}</td>
                            <td className="px-2 py-2" dir="ltr">{new Date(record.recordedAt).toLocaleString()}</td>
                            <td className="px-2 py-2">{record.recordedBy?.name || '-'}</td>
                            <td className="px-2 py-2">
                              {canConsume('correct') && (
                                <Button size="sm" variant="secondary" onClick={() => openCorrect(record)}>
                                  {t('production.materialRequirements.correctConsumption')}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {historyMeta.totalPages > 1 && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Button size="sm" variant="secondary" disabled={historyMeta.page <= 1} onClick={() => void loadHistoryPage(historyMeta.page - 1)}>
                      {t('common.previous')}
                    </Button>
                    <span className="text-gray-500" dir="ltr">{historyMeta.page} / {historyMeta.totalPages}</span>
                    <Button size="sm" variant="secondary" disabled={historyMeta.page >= historyMeta.totalPages} onClick={() => void loadHistoryPage(historyMeta.page + 1)}>
                      {t('common.next')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setValidationErrors({}); }} title={t('production.materialRequirements.prepare')} size="lg">
        <div className="space-y-4">
          <RequirementLinesEditor lines={formLines} onChange={setFormLines} error={validationErrors.lines} />
          <div>
            <Textarea
              label={t('production.materialRequirements.notes')}
              maxLength={2000}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveForm()} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={freezeConfirm}
        onClose={() => setFreezeConfirm(false)}
        onConfirm={() => void handleFreeze()}
        title={t('production.materialRequirements.freeze')}
        message={t('production.materialRequirements.freezeConfirmation')}
        confirmLabel={t('production.materialRequirements.freeze')}
        loading={saving}
      />

      <Modal open={cancelOpen} onClose={() => { setCancelOpen(false); setValidationErrors({}); }} title={t('production.materialRequirements.cancel')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('production.materialRequirements.cancelConfirmation')}</p>
          <div>
            <Textarea
              label={t('production.materialRequirements.cancelReason')}
              maxLength={2000}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            {validationErrors.cancelReason && <p className="mt-1 text-sm text-red-600">{validationErrors.cancelReason}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void handleCancel()} loading={saving}>{t('production.materialRequirements.cancel')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={recordOpen} onClose={() => setRecordOpen(false)} title={t('production.materialRequirements.recordConsumptionTitle')} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('production.materialRequirements.consumptionFact')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Select
                label={t('production.materialRequirements.requirementsLine') || t('production.materialRequirements.product')}
                value={recordForm.requirementLineId}
                placeholder={t('production.materialRequirements.unlinkedLine') || t('production.materialRequirements.selectProduct')}
                options={recordLineOptions}
                onChange={(e) => {
                  const line = snapshotLines.find((l) => l.id === e.target.value);
                  setRecordForm({
                    ...recordForm,
                    requirementLineId: e.target.value,
                    productId: line ? line.productId : '',
                    unit: line ? line.issueUnit : recordForm.unit,
                  });
                  setValidationErrors((prev) => ({ ...prev, productId: '' }));
                }}
              />
            </div>
            {!recordForm.requirementLineId && (
              <div className="col-span-2">
                <F9Lookup
                  label={t('production.materialRequirements.product')}
                  value={recordForm.productId}
                  adapter={productAdapter}
                  onChange={(v) => {
                    setRecordForm({ ...recordForm, productId: v });
                    setValidationErrors((prev) => ({ ...prev, productId: '' }));
                  }}
                />
                {validationErrors.productId && <p className="mt-1 text-sm text-red-600">{validationErrors.productId}</p>}
              </div>
            )}
            <div>
              <Input
                label={t('production.materialRequirements.quantity')}
                type="number"
                min="0"
                step="any"
                value={recordForm.quantity}
                onChange={(e) => setRecordForm({ ...recordForm, quantity: e.target.value })}
              />
              {validationErrors.quantity && <p className="mt-1 text-sm text-red-600">{validationErrors.quantity}</p>}
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.unit')}
                maxLength={50}
                value={recordForm.unit}
                onChange={(e) => setRecordForm({ ...recordForm, unit: e.target.value })}
              />
              {validationErrors.unit && <p className="mt-1 text-sm text-red-600">{validationErrors.unit}</p>}
            </div>
            <div className="col-span-2">
              <F9Lookup
                label={t('production.materialRequirements.productionRun')}
                value={recordForm.productionRunId}
                adapter={productionRunAdapter}
                onChange={(v) => setRecordForm({ ...recordForm, productionRunId: v })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.sourceDocumentNumber')}
                maxLength={200}
                value={recordForm.sourceDocumentNumber}
                onChange={(e) => setRecordForm({ ...recordForm, sourceDocumentNumber: e.target.value })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.sourceDocumentType')}
                maxLength={50}
                value={recordForm.sourceDocumentType}
                onChange={(e) => setRecordForm({ ...recordForm, sourceDocumentType: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Textarea
                label={t('production.materialRequirements.notes')}
                maxLength={2000}
                value={recordForm.notes}
                onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRecordOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleRecord()} loading={saving}>{t('production.materialRequirements.recordConsumption')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(correctTarget)} onClose={() => setCorrectTarget(null)} title={t('production.materialRequirements.correctConsumptionTitle')}>
        <div className="space-y-4">
          {correctTarget && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">{t('production.materialRequirements.product')}</p>
                <p className="mt-1 font-medium">[{correctTarget.product?.code || correctTarget.productCodeSnapshot}] {correctTarget.product?.name || correctTarget.productNameSnapshot}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('production.materialRequirements.previousQuantity')}</p>
                <p className="mt-1 font-medium" dir="ltr">{correctTarget.quantity} {correctTarget.unit}</p>
              </div>
            </div>
          )}
          <div>
            <Input
              label={t('production.materialRequirements.newQuantity')}
              type="number"
              min="0"
              step="any"
              value={correctForm.newQuantity}
              onChange={(e) => setCorrectForm({ ...correctForm, newQuantity: e.target.value })}
            />
            {validationErrors.newQuantity && <p className="mt-1 text-sm text-red-600">{validationErrors.newQuantity}</p>}
          </div>
          <div>
            <Textarea
              label={t('production.materialRequirements.reason')}
              maxLength={2000}
              value={correctForm.reason}
              onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })}
            />
            {validationErrors.reason && <p className="mt-1 text-sm text-red-600">{validationErrors.reason}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCorrectTarget(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleCorrect()} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
