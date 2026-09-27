'use client';
/**
 * R2-G — the single evidence form for every repair-order lifecycle action.
 *
 * Both the list grid and the detail workspace submit through this component, so
 * a quantity rule or a mandatory reason cannot be enforced in one place and
 * forgotten in the other. Which fields appear is decided by the action's
 * `formKind`, and the action itself is only ever one the backend published in its
 * workflow answer — the component never decides what is legal.
 */

import React from 'react';
import { Input, Select, Textarea, Modal, Button } from '../../../../components/admin/ui';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { RepairFormState, repairActionDef } from './repair-order-actions';
import { REPAIR_TARGET_CONDITIONS } from './repair-order-api';

interface RepairOrderActionDialogProps {
  actionKey: string | null;
  form: RepairFormState;
  fieldErrors: Record<string, string>;
  /** The order's authoritative remaining quantity, used to bound the inputs. */
  remaining: number;
  orderLabel?: string;
  saving?: boolean;
  error?: string;
  onChange: (next: RepairFormState) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function RepairOrderActionDialog({
  actionKey,
  form,
  fieldErrors,
  remaining,
  orderLabel,
  saving = false,
  error,
  onChange,
  onSubmit,
  onClose,
}: RepairOrderActionDialogProps) {
  const { t } = useTranslation();
  const def = actionKey ? repairActionDef(actionKey) : undefined;
  if (!def) return null;

  const set = (patch: Partial<RepairFormState>) => onChange({ ...form, ...patch });
  const err = (field: string) => (fieldErrors[field] ? t(fieldErrors[field]) : undefined);

  const targetConditionOptions = REPAIR_TARGET_CONDITIONS.map((condition) => ({
    value: condition,
    label: t(condition === 'USED_SERVICEABLE'
      ? 'maintenance.conditionUsedServiceable'
      : 'maintenance.conditionUsedRepairable'),
  }));

  const max = Number.isFinite(remaining) && remaining > 0 ? remaining : undefined;

  return (
    <Modal open onClose={onClose} title={t(def.labelKey)} size="md">
      <div className="space-y-4">
        {orderLabel ? (
          <p className="text-sm text-gray-600" data-testid="repair-dialog-order">{orderLabel}</p>
        ) : null}

        {error ? (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        {def.formKind === 'inspection' ? (
          <>
            <Select
              label={t('maintenance.inspectionOutcome')}
              name="outcome"
              required
              value={form.outcome}
              error={err('outcome')}
              onChange={(e) => set({ outcome: e.target.value })}
              options={[
                { value: 'REPAIRABLE', label: t('maintenance.inspectionRepairable') },
                { value: 'NOT_REPAIRABLE', label: t('maintenance.inspectionNotRepairable') },
              ]}
            />
            <Textarea
              label={t('maintenance.inspectionResult')}
              name="inspectionResult"
              required
              value={form.inspectionResult}
              error={err('inspectionResult')}
              onChange={(e) => set({ inspectionResult: e.target.value })}
            />
            <Textarea
              label={t('maintenance.failureDescription')}
              name="failureDescription"
              required={form.outcome === 'NOT_REPAIRABLE'}
              value={form.failureDescription}
              error={err('failureDescription')}
              onChange={(e) => set({ failureDescription: e.target.value })}
            />
          </>
        ) : null}

        {def.formKind === 'reason' || def.formKind === 'cancel' ? (
          <Textarea
            label={t('maintenance.repairReason')}
            name="reason"
            required
            value={form.reason}
            error={err('reason')}
            onChange={(e) => set({ reason: e.target.value })}
          />
        ) : null}

        {def.formKind === 'serviceable' ? (
          <>
            <Input
              label={t('maintenance.repairedQuantity')}
              name="repairedQuantity"
              type="number"
              step="0.001"
              min="0.001"
              max={max}
              required
              value={form.repairedQuantity}
              error={err('repairedQuantity')}
              onChange={(e) => set({ repairedQuantity: e.target.value })}
            />
            <Select
              label={t('maintenance.targetCondition')}
              name="targetCondition"
              required
              value={form.targetCondition}
              error={err('targetCondition')}
              onChange={(e) => set({ targetCondition: e.target.value })}
              options={targetConditionOptions}
            />
            <Textarea
              label={t('maintenance.repairDescription')}
              name="repairDescription"
              value={form.repairDescription}
              onChange={(e) => set({ repairDescription: e.target.value })}
            />
            <Textarea
              label={t('maintenance.testResult')}
              name="testResult"
              value={form.testResult}
              onChange={(e) => set({ testResult: e.target.value })}
            />
            <Textarea
              label={t('maintenance.repairTestNotes')}
              name="testNotes"
              value={form.testNotes}
              onChange={(e) => set({ testNotes: e.target.value })}
            />
          </>
        ) : null}

        {def.formKind === 'partial' ? (
          <>
            <Input
              label={t('maintenance.repairedQuantity')}
              name="repairedQuantity"
              type="number"
              step="0.001"
              min="0"
              max={max}
              value={form.repairedQuantity}
              error={err('repairedQuantity')}
              onChange={(e) => set({ repairedQuantity: e.target.value })}
            />
            <Input
              label={t('maintenance.scrappedQuantity')}
              name="scrappedQuantity"
              type="number"
              step="0.001"
              min="0"
              max={max}
              value={form.scrappedQuantity}
              error={err('scrappedQuantity')}
              onChange={(e) => set({ scrappedQuantity: e.target.value })}
            />
            <Select
              label={t('maintenance.targetCondition')}
              name="targetCondition"
              required
              value={form.targetCondition}
              error={err('targetCondition')}
              onChange={(e) => set({ targetCondition: e.target.value })}
              options={targetConditionOptions}
            />
          </>
        ) : null}

        {def.formKind === 'notRepairable' ? (
          <>
            <Input
              label={t('maintenance.repairNotRepairableQuantity')}
              name="notRepairableQuantity"
              type="number"
              step="0.001"
              min="0.001"
              max={max}
              required
              value={form.notRepairableQuantity}
              error={err('notRepairableQuantity')}
              onChange={(e) => set({ notRepairableQuantity: e.target.value })}
            />
            <Textarea
              label={t('maintenance.repairReason')}
              name="reason"
              required
              value={form.reason}
              error={err('reason')}
              onChange={(e) => set({ reason: e.target.value })}
            />
          </>
        ) : null}

        {def.formKind === 'scrap' ? (
          <>
            <Input
              label={t('maintenance.scrappedQuantity')}
              name="scrappedQuantity"
              type="number"
              step="0.001"
              min="0.001"
              max={max}
              required
              value={form.scrappedQuantity}
              error={err('scrappedQuantity')}
              onChange={(e) => set({ scrappedQuantity: e.target.value })}
            />
            <Textarea
              label={t('maintenance.repairReason')}
              name="reason"
              value={form.reason}
              onChange={(e) => set({ reason: e.target.value })}
            />
          </>
        ) : null}

        <Textarea
          label={t('maintenance.notes')}
          name="notes"
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant={def.danger ? 'danger' : 'primary'} onClick={onSubmit} disabled={saving}>
            {saving ? t('common.saving') : t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
