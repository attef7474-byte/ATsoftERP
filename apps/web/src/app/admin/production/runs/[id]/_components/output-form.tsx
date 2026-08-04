'use client';

import React, { useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { Button, Input, Select, Textarea } from '../../../../../../components/admin/ui';
import type { ProductionMeasurementPoint } from '../../../../../../lib/admin-types';

interface OutputFormProps {
  runId: string;
  runStatus: string;
  productionLineId: string;
  machineId?: string | null;
  measurementPoints: ProductionMeasurementPoint[];
  onSuccess: () => void;
}

function toLocalDatetimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + d + 'T' + h + ':' + min;
}

export function OutputForm({ runId, runStatus, productionLineId, machineId, measurementPoints, onSuccess }: OutputFormProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const [measurementPointId, setMeasurementPointId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [goodQuantity, setGoodQuantity] = useState('');
  const [rejectQuantity, setRejectQuantity] = useState('');
  const [rawCount, setRawCount] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetValue, setResetValue] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalDatetimeString(new Date()));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availablePoints = useMemo(() => {
    return measurementPoints.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (p.productionLineId && p.productionLineId !== productionLineId) return false;
      if (p.machineId && machineId && p.machineId !== machineId) return false;
      return true;
    });
  }, [measurementPoints, productionLineId, machineId]);

  const selectedPoint = availablePoints.find((p) => p.id === measurementPointId);
  const isCounter = selectedPoint?.source === 'COUNTER';
  const isManual = selectedPoint?.source === 'MANUAL';
  const isFinalOutput = selectedPoint?.role === 'FINAL_OUTPUT';
  const isRunning = runStatus === 'RUNNING';

  const goodNum = goodQuantity ? Number(goodQuantity) : 0;
  const rejectNum = rejectQuantity ? Number(rejectQuantity) : 0;
  const totalNum = quantity ? Number(quantity) : 0;

  const splitValid = !isManual || !isFinalOutput || goodNum + rejectNum <= totalNum;
  const counterValid = isCounter && rawCount !== '' && Number(rawCount) >= 0 && (!resetMode || resetValue === '' || Number(resetValue) >= 0);

  const canSubmit =
    isRunning &&
    Boolean(measurementPointId) &&
    ((isManual && quantity !== '' && totalNum > 0) || counterValid) &&
    Boolean(occurredAt) &&
    splitValid;

  const handleSelectPoint = (value: string) => {
    setMeasurementPointId(value);
    setQuantity('');
    setGoodQuantity('');
    setRejectQuantity('');
    setRawCount('');
    setResetMode(false);
    setResetValue('');
  };

  const handleSubmit = async () => {
    if (!selectedPoint || !canSubmit) return;
    setSubmitting(true);
    try {
      const body: any = {
        measurementPointId,
        occurredAt: new Date(occurredAt).toISOString(),
        requestId: crypto.randomUUID(),
      };
      if (isManual) {
        body.quantity = totalNum;
        if (isFinalOutput) {
          if (goodQuantity !== '') body.goodQuantity = goodNum;
          if (rejectQuantity !== '') body.rejectQuantity = rejectNum;
        }
      } else if (isCounter) {
        body.rawCount = Number(rawCount);
        body.resetMode = resetMode;
        if (resetMode && resetValue !== '') body.resetValue = Number(resetValue);
      }
      if (notes.trim()) body.notes = notes.trim();

      await api.post('/production/runs/' + runId + '/output-events', body);
      showToast(t('production.runs.outputRecorded'), 'success');
      setQuantity('');
      setGoodQuantity('');
      setRejectQuantity('');
      setRawCount('');
      setResetMode(false);
      setResetValue('');
      setNotes('');
      setOccurredAt(toLocalDatetimeString(new Date()));
      onSuccess();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isRunning) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('production.runs.notRunning')}</div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Select
        label={t('production.runs.selectMeasurementPoint')}
        required
        value={measurementPointId}
        onChange={(e) => handleSelectPoint(e.target.value)}
        placeholder={t('production.runs.selectMeasurementPoint')}
        options={availablePoints.map((p) => ({ value: p.id, label: p.code + ' - ' + p.name + (p.isAuthoritativeFinal ? ' *' : '') }))}
      />
      {!availablePoints.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}

      {selectedPoint && isManual && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('production.runs.quantity') + ' (' + selectedPoint.unit + ')'}
            required
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {isFinalOutput && (
            <>
              <Input
                label={t('production.runs.goodQuantity') + ' (' + selectedPoint.unit + ')'}
                type="number"
                min="0"
                step="any"
                value={goodQuantity}
                onChange={(e) => setGoodQuantity(e.target.value)}
              />
              <Input
                label={t('production.runs.rejectQuantity') + ' (' + selectedPoint.unit + ')'}
                type="number"
                min="0"
                step="any"
                value={rejectQuantity}
                onChange={(e) => setRejectQuantity(e.target.value)}
              />
            </>
          )}
        </div>
      )}

      {selectedPoint && isManual && isFinalOutput && !splitValid && (
        <div className="text-sm text-red-700">{t('production.runs.goodRejectExceeds')}</div>
      )}

      {selectedPoint && isCounter && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('production.runs.rawCount') + ' (' + selectedPoint.unit + ')'}
            required
            type="number"
            min="0"
            step="any"
            value={rawCount}
            onChange={(e) => setRawCount(e.target.value)}
          />
          <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={resetMode}
              onChange={(e) => setResetMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t('production.runs.resetCounter')}
          </label>
          {resetMode && (
            <Input
              label={t('production.runs.resetValue') + ' (' + selectedPoint.unit + ')'}
              type="number"
              min="0"
              step="any"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
            />
          )}
        </div>
      )}

      <Input
        label={t('production.runs.occurredAt')}
        required
        type="datetime-local"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
      />

      <Textarea
        label={t('production.runs.eventNotes')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {selectedPoint?.source === 'COUNTER' ? t('production.runs.recordCounterReading') : t('production.runs.recordOutput')}
        </Button>
      </div>
    </div>
  );
}
