'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiData } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Product, Unit } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Modal, LoadingState, ErrorState, Select } from '../../../../components/admin/ui';
import { F9Lookup, productCategoryAdapter, unitAdapter } from '../../../../components/f9';

export interface ProductFormProps {
  open: boolean;
  productId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface UomRow {
  key: string;
  unitId: string;
  unitLabel: string;
  parentUnitId: string;
  parentUnitLabel: string;
  quantityPerParent: string;
  barcode: string;
  isActive: boolean;
}

const unitLabelOf = (unit: { code: string; nameAr?: string; nameEn?: string } | undefined | null): string =>
  unit ? `[${unit.code}] ${unit.nameEn || unit.nameAr}` : '';

const makeRow = (): UomRow => ({
  key: `uom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  unitId: '',
  unitLabel: '',
  parentUnitId: '',
  parentUnitLabel: '',
  quantityPerParent: '1',
  barcode: '',
  isActive: true,
});

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  categoryId: '',
  unitId: '',
  barcode: '',
  minStock: '0',
  maxStock: '0',
};

function toUomRows(item: Product): UomRow[] {
  const all = item.uoms ?? [];
  const uomIdToUnitId = new Map<string, string>();
  const unitIdToLabel = new Map<string, string>();
  for (const uom of all) {
    uomIdToUnitId.set(uom.id, uom.unitId);
    unitIdToLabel.set(uom.unitId, unitLabelOf(uom.unit));
  }
  if (item.unitRef) unitIdToLabel.set(item.unitRef.id, unitLabelOf(item.unitRef));
  return all
    .filter((uom) => !uom.isBase)
    .map((uom) => {
      const parentUnitId = (uom.parentProductUomId
        ? uomIdToUnitId.get(uom.parentProductUomId)
        : undefined) ?? '';
      return {
        key: uom.id,
        unitId: uom.unitId,
        unitLabel: unitIdToLabel.get(uom.unitId) ?? unitLabelOf(uom.unit),
        parentUnitId,
        parentUnitLabel: parentUnitId ? (unitIdToLabel.get(parentUnitId) ?? parentUnitId) : '',
        quantityPerParent: String(uom.quantityPerParent),
        barcode: uom.barcode ?? '',
        isActive: uom.isActive,
      };
    });
}

/**
 * Canonical Product create/edit form. It is the ONLY form for both create and
 * edit: creation POSTs `/products`, editing PATCHes `/products/:id` for the SAME
 * record. It renders above the Products list and never navigates away from it.
 *
 * The base inventory unit comes from the global unit master (F9) only — there is
 * no free-text unit entry and no product-local unit dictionary. Additional rows
 * describe packaging levels (`PACKAGE -> BAG -> BALE`); the backend validates the
 * hierarchy (single base, no cycles, no self parent, positive quantities) and
 * rejects any payload that breaks it.
 */
export function ProductForm({ open, productId, onClose, onSaved }: ProductFormProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const isEdit = Boolean(productId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [baseUnitLabel, setBaseUnitLabel] = useState('');
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const loadedForRef = useRef<string | null>(null);

  const setField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const resetToBlank = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setBaseUnitLabel('');
    setUoms([]);
    setErrors({});
    setError('');
    setSaving(false);
  }, []);

  const loadProduct = useCallback(
    async (id: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<unknown>(`/products/${id}`);
        const item = unwrapApiData<Product>(res);
        if (!item || !item.id) throw new Error(t('complexForms.notFound'));
        const baseUnitId = item.unitId || item.unitRef?.id || (item.uoms ?? []).find((u) => u.isBase)?.unitId || '';
        setForm({
          code: item.code ?? '',
          name: item.name ?? '',
          description: item.description ?? '',
          categoryId: item.categoryId ?? '',
          unitId: baseUnitId,
          barcode: item.barcode ?? '',
          minStock: String(item.minStock ?? 0),
          maxStock: String(item.maxStock ?? 0),
        });
        setBaseUnitLabel(unitLabelOf(item.unitRef));
        setUoms(toUomRows(item));
        setErrors({});
        loadedForRef.current = id;
      } catch (err: any) {
        setError(err?.message || t('complexForms.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!open) {
      loadedForRef.current = null;
      return;
    }
    if (productId) {
      if (loadedForRef.current !== productId) void loadProduct(productId);
      return;
    }
    if (loadedForRef.current !== 'NEW') {
      loadedForRef.current = 'NEW';
      resetToBlank();
    }
  }, [open, productId, loadProduct, resetToBlank]);

  const updateRow = (key: string, patch: Partial<UomRow>) => {
    setUoms((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors({});
  };

  const removeRow = (key: string) => {
    setUoms((prev) => prev.filter((row) => row.key !== key));
    setErrors({});
  };

  const addRow = () => setUoms((prev) => [...prev, makeRow()]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('validation.required');
    if (isEdit && !form.code.trim()) errs.code = t('validation.required');
    if (!form.unitId) errs.unitId = t('validation.required');

    const parentOptions = new Set<string>();
    if (form.unitId) parentOptions.add(form.unitId);
    const seen = new Set<string>();
    uoms.forEach((row) => {
      if (row.unitId && seen.has(row.unitId)) {
        errs[`${row.key}.unitId`] = t('validation.duplicateValue');
      }
      if (row.unitId) seen.add(row.unitId);
    });

    uoms.forEach((row) => {
      if (!row.unitId) {
        errs[`${row.key}.unitId`] = t('validation.required');
      } else if (row.unitId === form.unitId) {
        errs[`${row.key}.unitId`] = t('validation.duplicateValue');
      }
      const qty = Number(row.quantityPerParent);
      if (row.quantityPerParent === '' || !Number.isFinite(qty) || qty <= 0) {
        errs[`${row.key}.quantityPerParent`] = t('validation.invalidQuantity');
      }
      if (row.parentUnitId) {
        parentOptions.add(row.parentUnitId);
      }
    });

    // A parent must be the base unit or another packaging unit of this product.
    uoms.forEach((row) => {
      if (!row.parentUnitId) return;
      if (row.parentUnitId === row.unitId) {
        errs[`${row.key}.parentUnitId`] = t('validation.invalidReference');
        return;
      }
      if (!parentOptions.has(row.parentUnitId)) {
        errs[`${row.key}.parentUnitId`] = t('validation.invalidReference');
      }
    });

    // Walk parent chains to reject cycles before they reach the backend.
    const parentByUnit = new Map<string, string>();
    uoms.forEach((row) => {
      if (row.unitId) parentByUnit.set(row.unitId, row.parentUnitId || form.unitId);
    });
    uoms.forEach((row) => {
      if (!row.unitId) return;
      let cursor: string | undefined = row.parentUnitId || form.unitId;
      let steps = 0;
      while (cursor && steps <= parentByUnit.size + 1) {
        if (cursor === row.unitId) {
          errs[`${row.key}.parentUnitId`] = t('validation.invalidReference');
          break;
        }
        cursor = parentByUnit.get(cursor);
        steps += 1;
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        unitId: form.unitId,
        barcode: form.barcode.trim() || undefined,
        minStock: Number(form.minStock) || 0,
        maxStock: Number(form.maxStock) || 0,
        // The base row is sent explicitly so a product with no packaging levels
        // still always carries exactly one base unit row, and so clearing every
        // packaging row can never drop the base unit.
        uoms: [
          {
            unitId: form.unitId,
            isBase: true,
            quantityPerParent: 1,
            isActive: true,
          },
          ...uoms.map((row) => ({
            unitId: row.unitId,
            parentUnitId: row.parentUnitId || undefined,
            quantityPerParent: Number(row.quantityPerParent),
            barcode: row.barcode.trim() || undefined,
            isActive: row.isActive,
          })),
        ],
      };

      if (productId) {
        await api.patch(`/products/${productId}`, payload);
        showToast(t('complexForms.recordUpdated'), 'success');
      } else {
        await api.post('/products', payload);
        showToast(t('complexForms.recordCreated'), 'success');
      }
      loadedForRef.current = null;
      onSaved();
      onClose();
    } catch (err: any) {
      const body = err?.response?.data;
      const message =
        body?.message ||
        body?.errors?.[0]?.message ||
        err?.message ||
        t('complexForms.updateFailed');
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const baseUnitOptions = uoms
    .filter((row) => row.unitId)
    .map((row) => ({ value: row.unitId, label: row.unitLabel || row.unitId }));

  const parentOptionsFor = (row: UomRow) => [
    { value: '', label: baseUnitLabel || t('inventory.baseUnit') },
    ...baseUnitOptions.filter((option) => option.value !== row.unitId),
  ];

  const renderError = (key: string) => (errors[key] ? <p className="text-red-500 text-sm mt-1">{errors[key]}</p> : null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('inventory.editProduct') : t('inventory.newProduct')}
      size="xl"
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => (productId ? loadProduct(productId) : undefined)} />
      ) : (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-700">{t('complexForms.basicInformation')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label={t('inventory.code')}
                value={form.code}
                onChange={(e) => setField('code', e.target.value)}
                required={isEdit}
                disabled={saving}
              />
              {!isEdit && (
                <p className="mt-1 text-xs text-gray-500">{t('inventory.autoGeneratedIfBlank')}</p>
              )}
              {renderError('code')}
            </div>
            <div>
              <Input
                label={t('inventory.name')}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                error={errors.name}
                required
                disabled={saving}
              />
            </div>
          </div>

          <Textarea
            label={t('inventory.description')}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            disabled={saving}
          />

          <h3 className="text-sm font-semibold text-gray-700 pt-2">{t('complexForms.classification')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup
              label={t('inventory.productCategory')}
              value={form.categoryId}
              onChange={(v) => setField('categoryId', v)}
              adapter={productCategoryAdapter}
              disabled={saving}
            />
            <div>
              <F9Lookup
                label={t('inventory.baseUnit')}
                value={form.unitId}
                onChange={(v) => setField('unitId', v)}
                onItemSelect={(unit: Unit) => setBaseUnitLabel(unitLabelOf(unit))}
                adapter={unitAdapter}
                clearOnContextChange={false}
                description={isEdit ? t('inventory.baseUnitLockedHint') : undefined}
                error={errors.unitId}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('inventory.barcode')}
              value={form.barcode}
              onChange={(e) => setField('barcode', e.target.value)}
              disabled={saving}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('inventory.minStock')}
                type="number"
                value={form.minStock}
                onChange={(e) => setField('minStock', e.target.value)}
                disabled={saving}
              />
              <Input
                label={t('inventory.maxStock')}
                type="number"
                value={form.maxStock}
                onChange={(e) => setField('maxStock', e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{t('inventory.packagingUnits')}</h3>
              <Button type="button" variant="secondary" onClick={addRow} disabled={saving || !form.unitId}>
                {t('inventory.addPackagingUnit')}
              </Button>
            </div>

            {!form.unitId && (
              <p className="text-sm text-gray-500 mb-3">{t('inventory.selectBaseUnitFirst')}</p>
            )}

            {uoms.length === 0 ? (
              <p className="text-sm text-gray-500">{t('inventory.noPackagingUnits')}</p>
            ) : (
              <div className="space-y-4">
                {uoms.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 border rounded-lg p-3"
                  >
                    <div className="md:col-span-4">
                      <F9Lookup
                        label={t('inventory.packagingUnit')}
                        value={row.unitId}
                        onChange={(v) => updateRow(row.key, { unitId: v })}
                        onItemSelect={(unit: Unit) =>
                          updateRow(row.key, { unitId: unit.id, unitLabel: unitLabelOf(unit) })
                        }
                        adapter={unitAdapter}
                        clearOnContextChange={false}
                        disabled={saving}
                      />
                      {renderError(`${row.key}.unitId`)}
                    </div>
                    <div className="md:col-span-3">
                      <Select
                        label={t('inventory.parentUnit')}
                        value={row.parentUnitId}
                        onChange={(e) => updateRow(row.key, { parentUnitId: e.target.value })}
                        options={parentOptionsFor(row).filter(
                          (option) => option.value !== row.unitId,
                        )}
                        disabled={saving}
                      />
                      {renderError(`${row.key}.parentUnitId`)}
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={t('inventory.quantityPerParent')}
                        type="number"
                        value={row.quantityPerParent}
                        onChange={(e) => updateRow(row.key, { quantityPerParent: e.target.value })}
                        disabled={saving}
                      />
                      {renderError(`${row.key}.quantityPerParent`)}
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={t('inventory.barcode')}
                        value={row.barcode}
                        onChange={(e) => updateRow(row.key, { barcode: e.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => removeRow(row.key)}
                        disabled={saving}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {t('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} loading={saving}>
              {t('actions.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
