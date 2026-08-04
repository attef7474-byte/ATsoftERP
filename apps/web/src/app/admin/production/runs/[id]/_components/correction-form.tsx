'use client';

import React, { useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { Button, Input, Select, Textarea } from '../../../../../../components/admin/ui';
import type { ProductionOutputEvent } from '../../../../../../lib/admin-types';

interface CorrectionFormProps {
  events: ProductionOutputEvent[];
  onSuccess: () => void;
}

export function CorrectionForm({ events, onSuccess }: CorrectionFormProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const [eventId, setEventId] = useState('');
  const [correctionQuantity, setCorrectionQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const productionEvents = useMemo(() => events.filter((e) => e.eventType === 'PRODUCTION'), [events]);

  const selectedEvent = productionEvents.find((e) => e.id === eventId);
  const correctionNum = correctionQuantity ? Number(correctionQuantity) : 0;

  const canSubmit = Boolean(selectedEvent) && correctionNum > 0 && reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!selectedEvent || !canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/production/output-events/' + selectedEvent.id + '/correct', {
        correctionQuantity: correctionNum,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        requestId: crypto.randomUUID(),
      });
      showToast(t('production.runs.correctionRecorded'), 'success');
      setCorrectionQuantity('');
      setReason('');
      setNotes('');
      onSuccess();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Select
        label={t('production.runs.selectEventToCorrect')}
        required
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        placeholder={t('production.runs.selectEventToCorrect')}
        options={productionEvents.map((e) => ({
          value: e.id,
          label: e.measurementPoint?.code + ' - ' + e.measurementPoint?.name + ' · ' + String(e.quantity) + ' ' + e.unit + ' · ' + new Date(e.occurredAt).toLocaleString(),
        }))}
      />
      {!productionEvents.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}

      {selectedEvent && (
        <div className="rounded border border-gray-200 bg-white p-3 text-sm">
          <div className="text-xs font-medium text-gray-500">{selectedEvent.measurementPoint?.code + ' - ' + selectedEvent.measurementPoint?.name}</div>
          <div className="mt-1 text-gray-900">
            {t('production.runs.quantity')}: {String(selectedEvent.quantity)} {selectedEvent.unit} · {t('production.runs.eventTypeProduction')}
          </div>
          <div className="text-xs text-gray-500">{new Date(selectedEvent.occurredAt).toLocaleString()}</div>
        </div>
      )}

      <Input
        label={t('production.runs.correctionQuantity') + (selectedEvent ? ' (' + selectedEvent.unit + ')' : '')}
        required
        type="number"
        min="0"
        step="any"
        value={correctionQuantity}
        onChange={(e) => setCorrectionQuantity(e.target.value)}
      />

      <Input
        label={t('production.runs.correctionReason')}
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <Textarea
        label={t('production.runs.eventNotes')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {t('production.runs.correctEvent')}
        </Button>
      </div>
    </div>
  );
}
