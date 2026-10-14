'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { unwrapApiData } from '../../lib/form-utils';
import { useTranslation } from '../../lib/i18n/use-translation';
import { Select } from '../admin/ui';
import type { Product, ProductUom } from '../../lib/admin-types';

export interface ProductUomSelection {
  productUomId: string;
  unitCode: string;
  isBase: boolean;
}

interface ProductUomSelectProps {
  productId: string;
  value: string;
  onSelect: (selection: ProductUomSelection) => void;
  label: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Canonical transaction-unit selector for production documents. It lists the
 * product's ProductUom rows (the single SKU packaging/conversion authority) so
 * the backend can convert the entered quantity to the base inventory unit. The
 * selected packaging unit is never interpreted locally — the base quantity is
 * always produced by the backend conversion authority.
 */
export function ProductUomSelect({ productId, value, onSelect, label, disabled, error }: ProductUomSelectProps) {
  const { t } = useTranslation();
  const [uoms, setUoms] = useState<ProductUom[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!productId) {
      setUoms([]);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    api
      .get<unknown>(`/products/${productId}`)
      .then((res) => {
        if (cancelled) return;
        const product = unwrapApiData<Product>(res);
        setUoms(product?.uoms ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setUoms([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const options = uoms.map((u) => ({
    value: u.id,
    label: `${u.unit?.code ?? u.unitId}${u.isBase ? ` (${t('production.uom.base')})` : ` × ${u.conversionToBase}`}`,
  }));

  const placeholder = !productId
    ? t('production.uom.selectProductFirst')
    : loading
      ? t('production.uom.loading')
      : !uoms.length
        ? failed
          ? t('production.uom.loadFailed')
          : t('production.uom.none')
        : t('production.uom.placeholder');

  return (
    <Select
      label={label}
      required
      disabled={disabled || !productId || loading || !uoms.length}
      value={value}
      placeholder={placeholder}
      error={error}
      options={options}
      onChange={(e) => {
        const selected = uoms.find((u) => u.id === e.target.value);
        onSelect({
          productUomId: e.target.value,
          unitCode: selected?.unit?.code ?? selected?.unitId ?? '',
          isBase: Boolean(selected?.isBase),
        });
      }}
    />
  );
}
