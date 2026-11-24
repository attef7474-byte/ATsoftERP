'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { Button, Input, Card, LoadingState, Modal, Pagination } from '@/components/admin/ui';
import {
  BarChart3,
  ClipboardCheck,
  Edit,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type Locale = 'en' | 'ar';
type ResourceKey = 'target' | 'weight' | 'rule';
type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

interface FieldDescriptor {
  key: string;
  labelKey: string;
  type: FieldType;
  required?: boolean;
  lockOnEdit?: boolean;
  options?: (kpis: any[], profiles: any[], locale: Locale, t: (key: string) => string) => { value: string; label: string }[];
  helpKey?: string;
}

interface ColumnDescriptor {
  labelKey: string;
  render: (row: any, ctx: { t: (key: string) => string; locale: Locale }) => ReactNode;
}

interface ResourceConfig {
  endpoint: string;
  titleKey: string;
  createKey: string;
  editKey: string;
  createPermission: string;
  updatePermission: string;
  deactivatePermission: string;
  emptyForm: () => Record<string, any>;
  toForm: (row: any) => Record<string, any>;
  createPayload: (form: Record<string, any>) => Record<string, any>;
  updatePayload: (form: Record<string, any>) => Record<string, any>;
  fields: FieldDescriptor[];
  columns: ColumnDescriptor[];
}

const S = 'core.performance.scoring.';

const SCOPE_TYPES = ['COMPANY', 'BRANCH', 'PRODUCTION_LINE', 'MACHINE', 'PRODUCT', 'DEPARTMENT', 'JOB_TITLE'];
const SCORING_MODES = ['LINEAR_TARGET', 'LINEAR_RANGE', 'THRESHOLD_BANDS', 'CAPPED_RATIO', 'TARGET_BAND', 'INVERSE_LINEAR'];
const DIRECTIONS = ['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_IS_BEST', 'INFORMATIONAL'];

function dateOnly(value: any): string {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function asString(value: any): string {
  return value === null || value === undefined ? '' : String(value);
}

function optionalNumber(value: any): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function kpiLabel(kpi: any, locale: Locale): string {
  if (!kpi) return '-';
  return locale === 'ar'
    ? kpi.nameAr || kpi.nameEn || kpi.name || kpi.code || '-'
    : kpi.nameEn || kpi.name || kpi.nameAr || kpi.code || '-';
}

function profileLabel(profile: any, locale: Locale): string {
  if (!profile) return '-';
  return locale === 'ar'
    ? profile.nameAr || profile.nameEn || profile.name || profile.code || '-'
    : profile.nameEn || profile.name || profile.nameAr || profile.code || '-';
}

function humanDate(value: any): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

const RESOURCES: Record<ResourceKey, ResourceConfig> = {
  target: {
    endpoint: '/performance/targets',
    titleKey: S + 'targetsTitle',
    createKey: S + 'createTarget',
    editKey: S + 'editTarget',
    createPermission: 'performance-target:create',
    updatePermission: 'performance-target:update',
    deactivatePermission: 'performance-target:deactivate',
    emptyForm: () => ({
      kpiDefinitionId: '', performanceProfileId: '', scopeType: 'COMPANY', targetValue: '',
      minimumAcceptableValue: '', maximumExceptionalValue: '', unit: '',
      effectiveFrom: '', effectiveTo: '', reason: '', notes: '',
    }),
    toForm: (row) => ({
      kpiDefinitionId: row.kpiDefinitionId, performanceProfileId: row.performanceProfileId || '',
      scopeType: row.scopeType, targetValue: asString(row.targetValue),
      minimumAcceptableValue: asString(row.minimumAcceptableValue),
      maximumExceptionalValue: asString(row.maximumExceptionalValue), unit: row.unit || '',
      effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: dateOnly(row.effectiveTo),
      reason: '', notes: '',
    }),
    createPayload: (f) => ({
      kpiDefinitionId: f.kpiDefinitionId,
      performanceProfileId: f.performanceProfileId || undefined,
      scopeType: f.scopeType,
      targetValue: optionalNumber(f.targetValue),
      minimumAcceptableValue: optionalNumber(f.minimumAcceptableValue),
      maximumExceptionalValue: optionalNumber(f.maximumExceptionalValue),
      unit: f.unit || undefined,
      effectiveFrom: f.effectiveFrom,
      effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined,
      notes: f.notes || undefined,
    }),
    updatePayload: (f) => ({
      scopeType: f.scopeType,
      targetValue: optionalNumber(f.targetValue),
      minimumAcceptableValue: optionalNumber(f.minimumAcceptableValue),
      maximumExceptionalValue: optionalNumber(f.maximumExceptionalValue),
      unit: f.unit || undefined,
      effectiveFrom: f.effectiveFrom,
      effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined,
      notes: f.notes || undefined,
    }),
    fields: [
      { key: 'kpiDefinitionId', labelKey: S + 'kpi', type: 'select', required: true, lockOnEdit: true, options: (k, _p, l) => k.map((x) => ({ value: x.id, label: kpiLabel(x, l) })) },
      { key: 'performanceProfileId', labelKey: S + 'profile', type: 'select', lockOnEdit: true, options: (_k, p, l) => p.map((x) => ({ value: x.id, label: profileLabel(x, l) })) },
      { key: 'scopeType', labelKey: S + 'scopeType', type: 'select', required: true, options: (_k, _p, _l, t) => SCOPE_TYPES.map((x) => ({ value: x, label: t(S + 'scope_' + x) })) },
      { key: 'targetValue', labelKey: S + 'targetValue', type: 'number', required: true },
      { key: 'minimumAcceptableValue', labelKey: S + 'minAcceptable', type: 'number' },
      { key: 'maximumExceptionalValue', labelKey: S + 'maxExceptional', type: 'number' },
      { key: 'unit', labelKey: S + 'unit', type: 'text' },
      { key: 'effectiveFrom', labelKey: S + 'effectiveFrom', type: 'date', required: true },
      { key: 'effectiveTo', labelKey: S + 'effectiveTo', type: 'date' },
      { key: 'reason', labelKey: S + 'reason', type: 'text' },
      { key: 'notes', labelKey: S + 'notes', type: 'text' },
    ],
    columns: [
      { labelKey: S + 'kpi', render: (r, { locale }) => kpiLabel(r.kpiDefinition, locale) },
      { labelKey: S + 'profile', render: (r, { locale }) => profileLabel(r.performanceProfile, locale) },
      { labelKey: S + 'scopeType', render: (r, { t }) => t(S + 'scope_' + r.scopeType) },
      { labelKey: S + 'targetValue', render: (r) => asString(r.targetValue) },
      { labelKey: S + 'revision', render: (r) => asString(r.revision) },
      { labelKey: S + 'effectiveFrom', render: (r) => humanDate(r.effectiveFrom) },
      { labelKey: S + 'status', render: (r, { t }) => t(S + 'status_' + r.status) },
    ],
  },
  weight: {
    endpoint: '/performance/weights',
    titleKey: S + 'weightsTitle',
    createKey: S + 'createWeight',
    editKey: S + 'editWeight',
    createPermission: 'performance-weight:create',
    updatePermission: 'performance-weight:update',
    deactivatePermission: 'performance-weight:deactivate',
    emptyForm: () => ({
      performanceProfileId: '', kpiDefinitionId: '', weightPercent: '',
      isRequired: false, isInformational: false,
      effectiveFrom: '', effectiveTo: '', reason: '', notes: '',
    }),
    toForm: (row) => ({
      performanceProfileId: row.performanceProfileId, kpiDefinitionId: row.kpiDefinitionId,
      weightPercent: asString(row.weightPercent), isRequired: !!row.isRequired,
      isInformational: !!row.isInformational,
      effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: dateOnly(row.effectiveTo),
      reason: '', notes: '',
    }),
    createPayload: (f) => ({
      performanceProfileId: f.performanceProfileId, kpiDefinitionId: f.kpiDefinitionId,
      weightPercent: optionalNumber(f.weightPercent),
      isRequired: !!f.isRequired, isInformational: !!f.isInformational,
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined, notes: f.notes || undefined,
    }),
    updatePayload: (f) => ({
      weightPercent: optionalNumber(f.weightPercent),
      isRequired: !!f.isRequired, isInformational: !!f.isInformational,
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined, notes: f.notes || undefined,
    }),
    fields: [
      { key: 'performanceProfileId', labelKey: S + 'profile', type: 'select', required: true, lockOnEdit: true, options: (_k, p, l) => p.map((x) => ({ value: x.id, label: profileLabel(x, l) })) },
      { key: 'kpiDefinitionId', labelKey: S + 'kpi', type: 'select', required: true, lockOnEdit: true, options: (k, _p, l) => k.map((x) => ({ value: x.id, label: kpiLabel(x, l) })) },
      { key: 'weightPercent', labelKey: S + 'weightPercent', type: 'number', required: true },
      { key: 'isRequired', labelKey: S + 'isRequired', type: 'checkbox' },
      { key: 'isInformational', labelKey: S + 'isInformational', type: 'checkbox', helpKey: S + 'informationalHelp' },
      { key: 'effectiveFrom', labelKey: S + 'effectiveFrom', type: 'date', required: true },
      { key: 'effectiveTo', labelKey: S + 'effectiveTo', type: 'date' },
      { key: 'reason', labelKey: S + 'reason', type: 'text' },
      { key: 'notes', labelKey: S + 'notes', type: 'text' },
    ],
    columns: [
      { labelKey: S + 'profile', render: (r, { locale }) => profileLabel(r.performanceProfile, locale) },
      { labelKey: S + 'kpi', render: (r, { locale }) => kpiLabel(r.kpiDefinition, locale) },
      { labelKey: S + 'weightPercent', render: (r) => asString(r.weightPercent) },
      { labelKey: S + 'isRequired', render: (r, { t }) => r.isRequired ? t('common.yes') : t('common.no') },
      { labelKey: S + 'isInformational', render: (r, { t }) => r.isInformational ? t('common.yes') : t('common.no') },
      { labelKey: S + 'status', render: (r, { t }) => t(S + 'status_' + r.status) },
    ],
  },
  rule: {
    endpoint: '/performance/scoring-rules',
    titleKey: S + 'rulesTitle',
    createKey: S + 'createRule',
    editKey: S + 'editRule',
    createPermission: 'performance-scoring-rule:create',
    updatePermission: 'performance-scoring-rule:update',
    deactivatePermission: 'performance-scoring-rule:deactivate',
    emptyForm: () => ({
      kpiDefinitionId: '', performanceProfileId: '', scoringMode: 'LINEAR_TARGET', direction: 'HIGHER_IS_BETTER',
      minScore: '0', maxScore: '100', targetScore: '', floorValue: '', targetValue: '', ceilingValue: '',
      bandsJson: '', effectiveFrom: '', effectiveTo: '', reason: '', notes: '',
    }),
    toForm: (row) => ({
      kpiDefinitionId: row.kpiDefinitionId, performanceProfileId: row.performanceProfileId || '',
      scoringMode: row.scoringMode, direction: row.direction,
      minScore: asString(row.minScore), maxScore: asString(row.maxScore), targetScore: asString(row.targetScore),
      floorValue: asString(row.floorValue), targetValue: asString(row.targetValue), ceilingValue: asString(row.ceilingValue),
      bandsJson: row.bandsJson || '', effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: dateOnly(row.effectiveTo),
      reason: '', notes: '',
    }),
    createPayload: (f) => ({
      kpiDefinitionId: f.kpiDefinitionId,
      performanceProfileId: f.performanceProfileId || undefined,
      scoringMode: f.scoringMode, direction: f.direction,
      minScore: optionalNumber(f.minScore), maxScore: optionalNumber(f.maxScore), targetScore: optionalNumber(f.targetScore),
      floorValue: optionalNumber(f.floorValue), targetValue: optionalNumber(f.targetValue), ceilingValue: optionalNumber(f.ceilingValue),
      bandsJson: f.bandsJson || undefined,
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined, notes: f.notes || undefined,
    }),
    updatePayload: (f) => ({
      scoringMode: f.scoringMode, direction: f.direction,
      minScore: optionalNumber(f.minScore), maxScore: optionalNumber(f.maxScore), targetScore: optionalNumber(f.targetScore),
      floorValue: optionalNumber(f.floorValue), targetValue: optionalNumber(f.targetValue), ceilingValue: optionalNumber(f.ceilingValue),
      bandsJson: f.bandsJson || undefined,
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || undefined,
      reason: f.reason || undefined, notes: f.notes || undefined,
    }),
    fields: [
      { key: 'kpiDefinitionId', labelKey: S + 'kpi', type: 'select', required: true, lockOnEdit: true, options: (k, _p, l) => k.map((x) => ({ value: x.id, label: kpiLabel(x, l) })) },
      { key: 'performanceProfileId', labelKey: S + 'profile', type: 'select', lockOnEdit: true, options: (_k, p, l) => p.map((x) => ({ value: x.id, label: profileLabel(x, l) })) },
      { key: 'scoringMode', labelKey: S + 'scoringMode', type: 'select', required: true, options: (_k, _p, _l, t) => SCORING_MODES.map((x) => ({ value: x, label: t(S + 'mode_' + x) })) },
      { key: 'direction', labelKey: S + 'direction', type: 'select', required: true, options: (_k, _p, _l, t) => DIRECTIONS.map((x) => ({ value: x, label: t(S + 'direction_' + x) })) },
      { key: 'minScore', labelKey: S + 'minScore', type: 'number' },
      { key: 'maxScore', labelKey: S + 'maxScore', type: 'number' },
      { key: 'targetScore', labelKey: S + 'targetScore', type: 'number' },
      { key: 'floorValue', labelKey: S + 'floorValue', type: 'number', helpKey: S + 'rangeHelp' },
      { key: 'targetValue', labelKey: S + 'targetValue', type: 'number' },
      { key: 'ceilingValue', labelKey: S + 'ceilingValue', type: 'number', helpKey: S + 'rangeHelp' },
      { key: 'bandsJson', labelKey: S + 'bandsJson', type: 'text' },
      { key: 'effectiveFrom', labelKey: S + 'effectiveFrom', type: 'date', required: true },
      { key: 'effectiveTo', labelKey: S + 'effectiveTo', type: 'date' },
      { key: 'reason', labelKey: S + 'reason', type: 'text' },
      { key: 'notes', labelKey: S + 'notes', type: 'text' },
    ],
    columns: [
      { labelKey: S + 'kpi', render: (r, { locale }) => kpiLabel(r.kpiDefinition, locale) },
      { labelKey: S + 'profile', render: (r, { locale }) => profileLabel(r.performanceProfile, locale) },
      { labelKey: S + 'scoringMode', render: (r, { t }) => t(S + 'mode_' + r.scoringMode) },
      { labelKey: S + 'direction', render: (r, { t }) => t(S + 'direction_' + r.direction) },
      { labelKey: S + 'revision', render: (r) => asString(r.revision) },
      { labelKey: S + 'status', render: (r, { t }) => t(S + 'status_' + r.status) },
    ],
  },
};

function issueText(code: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    MISSING_WEIGHT: S + 'issueMissingWeight',
    MISSING_TARGET: S + 'issueMissingTarget',
    MISSING_RULE: S + 'issueMissingRule',
    MISSING_SCORING_RULE: S + 'issueMissingRule',
    INVALID_WEIGHT_TOTAL: S + 'issueInvalidTotal',
    OVERLAPPING_CONFIGURATION: S + 'issueOverlap',
    KPI_NOT_ACTIVE: S + 'issueKpiNotActive',
    NO_ACTIVE_WEIGHTS: S + 'issueNoWeights',
    AMBIGUOUS_TARGET: S + 'issueAmbiguousTarget',
    NO_TARGET: S + 'issueNoTarget',
  };
  return map[code] ? t(map[code]) : code;
}

function scoreStatusText(code: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    CALCULABLE: S + 'statusCalculable',
    CONFIGURATION_MISSING: S + 'statusConfigurationMissing',
    INSUFFICIENT_DATA: S + 'statusInsufficient',
    NOT_APPLICABLE: S + 'statusNotApplicable',
    INFORMATIONAL: S + 'statusInformational',
    SOURCE_UNAVAILABLE: S + 'statusSourceUnavailable',
    ATTRIBUTION_AMBIGUOUS: S + 'statusAttributionAmbiguous',
  };
  return map[code] ? t(map[code]) : code;
}

function simulationStatusText(code: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    PREVIEW: S + 'simStatusPreview',
    INCOMPLETE: S + 'simStatusIncomplete',
    CONFIGURATION_MISSING: S + 'simStatusConfigMissing',
    CONFIGURATION_PERIOD_SPLIT_REQUIRED: S + 'simStatusSplit',
  };
  return map[code] ? t(map[code]) : code;
}

function FieldControl({ field, value, error, disabled, locale, kpis, profiles, onChange }: {
  field: FieldDescriptor;
  value: any;
  error?: string;
  disabled?: boolean;
  locale: Locale;
  kpis: any[];
  profiles: any[];
  onChange: (value: any) => void;
}) {
  const { t } = useTranslation();
  const label = t(field.labelKey);
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {label}
          {field.helpKey && <span className="block text-xs text-gray-500">{t(field.helpKey)}</span>}
        </span>
      </label>
    );
  }
  if (field.type === 'select') {
    const options = field.options ? field.options(kpis, profiles, locale, t) : [];
    return (
      <label className="block text-sm">
        {label}{field.required ? ' *' : ''}
        <select
          className="mt-1 w-full border rounded px-3 py-2"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          <option value="">{t(S + 'select')}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </label>
    );
  }
  return (
    <div>
      <Input
        label={label + (field.required ? ' *' : '')}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value ?? ''}
        disabled={disabled}
        error={error}
        onChange={(e: any) => onChange(e.target.value)}
      />
      {field.helpKey && <span className="block text-xs text-gray-500 mt-1">{t(field.helpKey)}</span>}
    </div>
  );
}

function ConfigPanel({ resource, can, kpis, profiles, refreshToken }: {
  resource: ResourceKey;
  can: (permission: string) => boolean;
  kpis: any[];
  profiles: any[];
  refreshToken: number;
}) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const cfg = RESOURCES[resource];
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editingId: string | null; form: Record<string, any> } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestRows = async (page: number) => {
    const params = { params: { page, limit: 20 } };
    if (resource === 'target') return await api.get('/performance/targets', params) as any;
    if (resource === 'weight') return await api.get('/performance/weights', params) as any;
    return await api.get('/performance/scoring-rules', params) as any;
  };

  const createRow = async (payload: Record<string, any>) => {
    if (resource === 'target') return await api.post('/performance/targets', payload);
    if (resource === 'weight') return await api.post('/performance/weights', payload);
    return await api.post('/performance/scoring-rules', payload);
  };

  const updateRow = async (id: string, payload: Record<string, any>) => {
    if (resource === 'target') return await api.patch(`/performance/targets/${id}`, payload);
    if (resource === 'weight') return await api.patch(`/performance/weights/${id}`, payload);
    return await api.patch(`/performance/scoring-rules/${id}`, payload);
  };

  const transitionRow = async (id: string, action: 'activate' | 'deactivate') => {
    if (resource === 'target') return await api.post(`/performance/targets/${id}/${action}`, {});
    if (resource === 'weight') return await api.post(`/performance/weights/${id}/${action}`, {});
    return await api.post(`/performance/scoring-rules/${id}/${action}`, {});
  };

  const fetchRows = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await requestRows(page);
      setRows(res.data || []);
      setMeta(res.meta || { page, limit: 20, total: 0, totalPages: 0 });
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resource, showToast, t]);

  useEffect(() => { fetchRows(1); }, [fetchRows, refreshToken]);

  const openCreate = () => {
    setErrors({});
    setModal({ editingId: null, form: cfg.emptyForm() });
  };

  const openEdit = (row: any) => {
    if (row.status !== 'DRAFT') return;
    setErrors({});
    setModal({ editingId: row.id, form: cfg.toForm(row) });
  };

  const save = async () => {
    if (!modal) return;
    const nextErrors: Record<string, string> = {};
    for (const field of cfg.fields) {
      if (field.required && (modal.form[field.key] === '' || modal.form[field.key] === undefined || modal.form[field.key] === null)) {
        nextErrors[field.key] = t('validation.required');
      }
    }
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setSaving(true);
    try {
      const payload = modal.editingId ? cfg.updatePayload(modal.form) : cfg.createPayload(modal.form);
      if (modal.editingId) await updateRow(modal.editingId, payload);
      else await createRow(payload);
      showToast(t(modal.editingId ? 'common.successUpdated' : 'common.successCreated'), 'success');
      setModal(null);
      await fetchRows(meta.page);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (id: string, action: 'activate' | 'deactivate') => {
    setBusyId(id);
    try {
      await transitionRow(id, action);
      showToast(t('common.successUpdated'), 'success');
      await fetchRows(meta.page);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.saveFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const canCreate = can(cfg.createPermission);
  const canUpdate = can(cfg.updatePermission);
  const canDeactivate = can(cfg.deactivatePermission);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">{t(cfg.titleKey)}</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchRows(meta.page)} aria-label={t(S + 'refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t(S + 'create')}</Button>}
        </div>
      </div>

      {loading ? <LoadingState /> : (
        <>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  {cfg.columns.map((c) => <th key={c.labelKey} className="py-2 px-2">{t(c.labelKey)}</th>)}
                  <th className="py-2 px-2">{t(S + 'effectiveFrom')}</th>
                  <th className="py-2 px-2">{t(S + 'actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    {cfg.columns.map((c, i) => <td key={i} className="py-2 px-2">{c.render(row, { t, locale })}</td>)}
                    <td className="py-2 px-2">{humanDate(row.effectiveFrom)}</td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-1">
                        {canUpdate && row.status === 'DRAFT' && (
                          <Button variant="secondary" size="sm" onClick={() => openEdit(row)} aria-label={t(S + 'edit')}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        {canUpdate && row.status !== 'ACTIVE' && row.status !== 'INACTIVE' && (
                          <Button variant="secondary" size="sm" disabled={busyId === row.id} onClick={() => transition(row.id, 'activate')}>
                            <Power className="h-3 w-3 mr-1" />{t(S + 'activate')}
                          </Button>
                        )}
                        {canDeactivate && row.status === 'ACTIVE' && (
                          <Button variant="secondary" size="sm" disabled={busyId === row.id} onClick={() => transition(row.id, 'deactivate')}>
                            <PowerOff className="h-3 w-3 mr-1" />{t(S + 'deactivate')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={cfg.columns.length + 2} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={(p) => fetchRows(p)} />
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.editingId ? t(cfg.editKey) : t(cfg.createKey)}>
        {modal && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cfg.fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={modal.form[field.key]}
                  error={errors[field.key]}
                  disabled={saving || (!!modal.editingId && field.lockOnEdit)}
                  locale={locale}
                  kpis={kpis}
                  profiles={profiles}
                  onChange={(value) => {
                    const next = { ...modal.form, [field.key]: value };
                    if (field.key === 'isInformational' && value === true) next.weightPercent = '0';
                    setModal({ ...modal, form: next });
                    setErrors({ ...errors, [field.key]: '' });
                  }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>{t('common.cancel')}</Button>
              <Button onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function ReadinessPanel({ profiles, canRead }: { profiles: any[]; canRead: boolean }) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [profileId, setProfileId] = useState('');
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!profileId) { showToast(t('validation.required'), 'error'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/performance/profiles/${profileId}/readiness`, {
        params: { at: new Date(`${at}T23:59:59.999Z`).toISOString() },
      }) as any;
      setResult(res);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">{t(S + 'readinessTitle')}</h2>
      {!canRead && <p className="text-sm text-amber-600 mb-3">{t(S + 'permissionNotice')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className="block text-sm md:col-span-2">
          {t(S + 'profile')}
          <select className="mt-1 w-full border rounded px-3 py-2" value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label={t(S + 'profile')}>
            <option value="">{t(S + 'selectProfile')}</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p, locale)} ({p.code})</option>)}
          </select>
        </label>
        <Input label={t(S + 'at')} type="date" value={at} onChange={(e: any) => setAt(e.target.value)} />
        <Button onClick={run} disabled={loading || !canRead}><ClipboardCheck className="h-4 w-4 mr-1" />{loading ? t('common.loading') : t(S + 'checkReadiness')}</Button>
      </div>
      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'status')}: {result.status === 'READY_FOR_SCORING' ? t(S + 'ready') : t(S + 'notReady')}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'activeWeightTotal')}: {asString(result.activeWeightTotal)}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'weightOk')}: {result.weightOk ? t('common.yes') : t('common.no')}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'issueCount')}: {asString(result.issueCount)}</span>
          </div>
          {!!result.issues?.length && (
            <div>
              <h3 className="font-medium mb-1">{t(S + 'issues')}</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {result.issues.map((issue: any, i: number) => (
                  <li key={i}>
                    {issueText(issue.code || issue.issues?.[0] || '', t)}
                    {issue.code ? ` (${issue.code})` : ''}
                    {issue.entity ? ` - ${issue.entity}` : ''}
                    {issue.issues?.length > 1 ? `: ${issue.issues.slice(1).map((x: string) => issueText(x, t)).join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="py-2 px-2">{t(S + 'kpi')}</th>
                  <th className="py-2 px-2">{t(S + 'weightPercent')}</th>
                  <th className="py-2 px-2">{t(S + 'ruleRevision')}</th>
                  <th className="py-2 px-2">{t(S + 'resolvedTarget')}</th>
                  <th className="py-2 px-2">{t(S + 'targetSource')}</th>
                  <th className="py-2 px-2">{t(S + 'issues')}</th>
                </tr>
              </thead>
              <tbody>
                {(result.items || []).map((item: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 px-2">{kpiLabel(item.kpi, locale)}</td>
                    <td className="py-2 px-2">{asString(item.weightPercent)}</td>
                    <td className="py-2 px-2">{item.rule ? asString(item.rule.revision) : '-'}</td>
                    <td className="py-2 px-2">{item.targetEvidence?.resolvedTarget ?? '-'}</td>
                    <td className="py-2 px-2">{item.targetEvidence?.targetSource || '-'}</td>
                    <td className="py-2 px-2">{(item.issues || []).map((x: string) => issueText(x, t)).join(', ') || '-'}</td>
                  </tr>
                ))}
                {!result.items?.length && <tr><td colSpan={6} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function CoveragePanel({ canRead }: { canRead: boolean }) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.get('/performance/configuration-coverage', {
        params: { at: new Date(`${at}T23:59:59.999Z`).toISOString() },
      }) as any;
      setResult(res);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    ['totalProfiles', result?.totalProfiles],
    ['ready', result?.ready],
    ['notReady', result?.notReady],
    ['missingWeight', result?.missingWeight],
    ['missingTarget', result?.missingTarget],
    ['missingRule', result?.missingRule],
    ['invalidWeightTotal', result?.invalidWeightTotal],
    ['overlap', result?.overlap],
  ];

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">{t(S + 'coverageTitle')}</h2>
      {!canRead && <p className="text-sm text-amber-600 mb-3">{t(S + 'permissionNotice')}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <Input label={t(S + 'at')} type="date" value={at} onChange={(e: any) => setAt(e.target.value)} />
        <Button onClick={run} disabled={loading || !canRead}><RefreshCw className="h-4 w-4 mr-1" />{loading ? t('common.loading') : t(S + 'checkCoverage')}</Button>
      </div>
      {result && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {cards.map(([key, value]) => (
              <div key={key as string} className="border rounded p-2">
                <div className="text-xs text-gray-500">{t(S + String(key))}</div>
                <div className="text-lg font-semibold">{asString(value)}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="py-2 px-2">{t(S + 'profile')}</th>
                  <th className="py-2 px-2">{t(S + 'status')}</th>
                  <th className="py-2 px-2">{t(S + 'activeWeightTotal')}</th>
                  <th className="py-2 px-2">{t(S + 'issueCount')}</th>
                </tr>
              </thead>
              <tbody>
                {(result.profiles || []).map((p: any) => (
                  <tr key={p.profile?.id} className="border-b">
                    <td className="py-2 px-2">{profileLabel(p.profile, locale)} ({p.profile?.code})</td>
                    <td className="py-2 px-2">{p.status === 'READY_FOR_SCORING' ? t(S + 'ready') : t(S + 'notReady')}</td>
                    <td className="py-2 px-2">{asString(p.activeWeightTotal)}</td>
                    <td className="py-2 px-2">{asString(p.issueCount)}</td>
                  </tr>
                ))}
                {!result.profiles?.length && <tr><td colSpan={4} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function SimulationPanel({ employees, canRead }: { employees: any[]; canRead: boolean }) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setUTCDate(1);
  const [personId, setPersonId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!personId) { showToast(t('validation.required'), 'error'); return; }
    setLoading(true);
    try {
      const res = await api.post('/performance/simulate', {
        operationalPersonId: personId,
        dateFrom: new Date(`${dateFrom}T00:00:00.000Z`).toISOString(),
        dateTo: new Date(`${dateTo}T23:59:59.999Z`).toISOString(),
      }) as any;
      setResult(res);
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">{t(S + 'simulationTitle')}</h2>
      <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-2 text-sm mb-4">
        {t(S + 'previewBanner')}
      </div>
      {!canRead && <p className="text-sm text-amber-600 mb-3">{t(S + 'permissionNotice')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className="block text-sm md:col-span-2">
          {t(S + 'employee')}
          <select className="mt-1 w-full border rounded px-3 py-2" value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label={t(S + 'employee')}>
            <option value="">{t(S + 'selectEmployee')}</option>
            {employees.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ''}{p.nameAr && locale === 'ar' ? p.nameAr : p.name || p.nameEn || p.code}</option>)}
          </select>
        </label>
        <Input label={t(S + 'dateFrom')} type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} />
        <Input label={t(S + 'dateTo')} type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} />
        <div className="md:col-span-4">
          <Button onClick={run} disabled={loading || !canRead}><Play className="h-4 w-4 mr-1" />{loading ? t('common.loading') : t(S + 'runSimulation')}</Button>
        </div>
      </div>
      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'simulationStatus')}: {simulationStatusText(result.status, t)}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'simulationLabel')}: {result.simulationLabel === 'PREVIEW_ONLY_NOT_APPROVED' ? t(S + 'simLabel') : result.simulationLabel || '-'}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'previewOnly')}: {result.previewOnly ? t('common.yes') : t('common.no')}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'noPersisted')}: {result.noPersistedEvaluation ? t('common.yes') : t('common.no')}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'provisionalTotal')}: {result.provisionalTotal ?? '-'}</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'completenessPercent')}: {asString(result.completenessPercent)}%</span>
            <span className="px-2 py-1 rounded bg-gray-100">{t(S + 'configuredWeightCovered')}: {asString(result.configuredWeightCovered)}</span>
          </div>
          {!!result.missingRequiredKpis?.length && (
            <div className="text-sm text-red-700">
              {t(S + 'missingRequired')}: {result.missingRequiredKpis.map((x: any) => x.code || x.kpiDefinitionId).join(', ')}
            </div>
          )}
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="py-2 px-2">{t(S + 'kpi')}</th>
                  <th className="py-2 px-2">{t(S + 'rawValue')}</th>
                  <th className="py-2 px-2">{t(S + 'resolvedTarget')}</th>
                  <th className="py-2 px-2">{t(S + 'score')}</th>
                  <th className="py-2 px-2">{t(S + 'scoreStatus')}</th>
                  <th className="py-2 px-2">{t(S + 'weightPercent')}</th>
                  <th className="py-2 px-2">{t(S + 'weightedContribution')}</th>
                  <th className="py-2 px-2">{t(S + 'evidenceCount')}</th>
                  <th className="py-2 px-2">{t(S + 'versionTrace')}</th>
                  <th className="py-2 px-2">{t(S + 'explanation')}</th>
                </tr>
              </thead>
              <tbody>
                {(result.kpis || []).map((k: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 px-2">{kpiLabel(k.kpi, locale)}</td>
                    <td className="py-2 px-2">{k.rawValue ?? '-'}</td>
                    <td className="py-2 px-2">{k.target?.targetValue ?? k.targetEvidence?.resolvedTarget ?? '-'}</td>
                    <td className="py-2 px-2">{k.score ?? '-'}</td>
                    <td className="py-2 px-2">{scoreStatusText(k.scoreStatus, t)}</td>
                    <td className="py-2 px-2">{asString(k.weightPercent)}</td>
                    <td className="py-2 px-2">{k.weightedContribution ?? '-'}</td>
                    <td className="py-2 px-2">{asString(k.evidenceCount)}</td>
                    <td className="py-2 px-2">{k.versions ? `K${k.versions.kpiCalculationVersion ?? '-'} R${k.versions.scoringRuleVersion ?? '-'} T${k.versions.targetRevision ?? '-'} W${k.versions.weightRevision ?? '-'}` : '-'}</td>
                    <td className="py-2 px-2">{k.explanation || k.rawExplanation || '-'}</td>
                  </tr>
                ))}
                {!result.kpis?.length && <tr><td colSpan={10} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PerformanceScoringPage() {
  const { t } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const can = useCallback((permission: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(permission)), [isSuperAdmin, permissions]);
  const [tab, setTab] = useState<'target' | 'weight' | 'rule' | 'readiness' | 'coverage' | 'simulation'>('target');
  const [kpis, setKpis] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [kpiRes, profileRes, employeeRes] = await Promise.all([
          api.get('/performance/kpis', { params: { page: 1, limit: 200 } }) as any,
          api.get('/performance/profiles', { params: { page: 1, limit: 200 } }) as any,
          api.get('/production/operational-people', { params: { page: 1, limit: 200, isActive: 'true' } }) as any,
        ]);
        if (!alive) return;
        setKpis(kpiRes.data || kpiRes.items || []);
        setProfiles(profileRes.data || profileRes.items || []);
        setEmployees(employeeRes.data || employeeRes.items || []);
      } catch {
        // Individual panels surface their own load errors; lookups simply remain empty.
      }
    })();
    return () => { alive = false; };
  }, [refreshToken]);

  const tabs: { key: typeof tab; labelKey: string; icon: ReactNode; permission: string }[] = [
    { key: 'target', labelKey: S + 'targets', icon: <SlidersHorizontal className="h-4 w-4" />, permission: 'performance-target:read' },
    { key: 'weight', labelKey: S + 'weights', icon: <BarChart3 className="h-4 w-4" />, permission: 'performance-weight:read' },
    { key: 'rule', labelKey: S + 'rules', icon: <RotateCcw className="h-4 w-4" />, permission: 'performance-scoring-rule:read' },
    { key: 'readiness', labelKey: S + 'readiness', icon: <ClipboardCheck className="h-4 w-4" />, permission: 'performance-weight:read' },
    { key: 'coverage', labelKey: S + 'coverage', icon: <ShieldCheck className="h-4 w-4" />, permission: 'performance-config-coverage:read' },
    { key: 'simulation', labelKey: S + 'simulation', icon: <Play className="h-4 w-4" />, permission: 'performance-simulation:read' },
  ];
  const visibleTabs = tabs.filter((x) => can(x.permission));

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(S + 'title')}</h1>
          <p className="text-sm text-gray-500">{t(S + 'subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRefreshToken((x) => x + 1)}>
          <RefreshCw className="h-4 w-4 mr-1" />{t(S + 'refresh')}
        </Button>
      </div>

      {!visibleTabs.length && <p className="text-sm text-amber-600">{t(S + 'permissionNotice')}</p>}
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((x) => (
          <Button key={x.key} variant={tab === x.key ? 'primary' : 'secondary'} size="sm" onClick={() => setTab(x.key)}>
            {x.icon}<span className="mr-1">{t(x.labelKey)}</span>
          </Button>
        ))}
      </div>

      {tab === 'target' && <ConfigPanel resource="target" can={can} kpis={kpis} profiles={profiles} refreshToken={refreshToken} />}
      {tab === 'weight' && <ConfigPanel resource="weight" can={can} kpis={kpis} profiles={profiles} refreshToken={refreshToken} />}
      {tab === 'rule' && <ConfigPanel resource="rule" can={can} kpis={kpis} profiles={profiles} refreshToken={refreshToken} />}
      {tab === 'readiness' && <ReadinessPanel profiles={profiles} canRead={can('performance-weight:read')} />}
      {tab === 'coverage' && <CoveragePanel canRead={can('performance-config-coverage:read')} />}
      {tab === 'simulation' && <SimulationPanel employees={employees} canRead={can('performance-simulation:read')} />}
    </div>
  );
}
