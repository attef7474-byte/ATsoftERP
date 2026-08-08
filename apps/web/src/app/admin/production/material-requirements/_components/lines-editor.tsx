'use client';

import React from 'react';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Input, Select } from '../../../../../components/admin/ui';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { productAdapter, warehouseAdapter } from '../../../../../components/f9/lookup-adapters';

export interface RequirementLineDraft {
  key: string;
  productId: string;
  plannedQuantityPerUnit: string;
  baseUnit: string;
  issueUnit: string;
  conversionFactor: string;
  componentRole: string;
  warehouseId: string;
  overIssuePolicy: string;
  tolerancePercent: string;
  productionStage: string;
  lotControlRequired: boolean;
  notes: string;
}

export function createEmptyRequirementLine(): RequirementLineDraft {
  return {
    key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    productId: '',
    plannedQuantityPerUnit: '',
    baseUnit: '',
    issueUnit: '',
    conversionFactor: '1',
    componentRole: 'RAW_MATERIAL',
    warehouseId: '',
    overIssuePolicy: 'NOT_ALLOWED',
    tolerancePercent: '',
    productionStage: '',
    lotControlRequired: false,
    notes: '',
  };
}

const COMPONENT_ROLES = ['RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED', 'OTHER'];
const OVER_ISSUE_POLICIES = ['NOT_ALLOWED', 'WITH_REASON', 'TOLERANCE'];

interface LinesEditorProps {
  lines: RequirementLineDraft[];
  onChange: (lines: RequirementLineDraft[]) => void;
  error?: string;
}

export function RequirementLinesEditor({ lines, onChange, error }: LinesEditorProps) {
  const { t } = useTranslation();

  const updateLine = (key: string, patch: Partial<RequirementLineDraft>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((line) => line.key !== key));
  };

  const addLine = () => {
    onChange([...lines, createEmptyRequirementLine()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('production.materialRequirements.lines')}</span>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          {t('production.materialRequirements.addLine')}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lines.map((line, index) => (
        <div key={line.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {t('production.materialRequirements.lines')} #{index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeLine(line.key)}
              disabled={lines.length <= 1}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('production.materialRequirements.removeLine')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <F9Lookup
                label={t('production.materialRequirements.product')}
                value={line.productId}
                adapter={productAdapter}
                onChange={(v) => updateLine(line.key, { productId: v })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.plannedQuantityPerUnit')}
                type="number"
                min="0"
                step="any"
                value={line.plannedQuantityPerUnit}
                onChange={(e) => updateLine(line.key, { plannedQuantityPerUnit: e.target.value })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.baseUnit')}
                maxLength={50}
                value={line.baseUnit}
                onChange={(e) => updateLine(line.key, { baseUnit: e.target.value })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.issueUnit')}
                maxLength={50}
                value={line.issueUnit}
                onChange={(e) => updateLine(line.key, { issueUnit: e.target.value })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialRequirements.conversionFactor')}
                type="number"
                min="0"
                step="any"
                value={line.conversionFactor}
                onChange={(e) => updateLine(line.key, { conversionFactor: e.target.value })}
              />
            </div>
            <div>
              <Select
                label={t('production.materialRequirements.componentRole')}
                value={line.componentRole}
                options={COMPONENT_ROLES.map((role) => ({ value: role, label: t('production.materialRequirements.role' + role) }))}
                onChange={(e) => updateLine(line.key, { componentRole: e.target.value })}
              />
            </div>
            <div>
              <Select
                label={t('production.materialRequirements.overIssuePolicy')}
                value={line.overIssuePolicy}
                options={OVER_ISSUE_POLICIES.map((policy) => ({ value: policy, label: t('production.materialRequirements.policy' + policy) }))}
                onChange={(e) => updateLine(line.key, { overIssuePolicy: e.target.value })}
              />
            </div>
            {line.overIssuePolicy === 'TOLERANCE' && (
              <div>
                <Input
                  label={t('production.materialRequirements.tolerancePercent')}
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={line.tolerancePercent}
                  onChange={(e) => updateLine(line.key, { tolerancePercent: e.target.value })}
                />
              </div>
            )}
            <div className={line.overIssuePolicy === 'TOLERANCE' ? '' : 'col-span-2'}>
              <F9Lookup
                label={t('production.materialRequirements.warehouse')}
                value={line.warehouseId}
                adapter={warehouseAdapter}
                onChange={(v) => updateLine(line.key, { warehouseId: v })}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('production.materialRequirements.lineNotes')}
                maxLength={2000}
                value={line.notes}
                onChange={(e) => updateLine(line.key, { notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
