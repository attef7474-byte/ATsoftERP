'use client';

import { useTranslation } from '../../../lib/i18n/use-translation';
import {
  translateAuditAction,
  translateBarcodeType,
  translateEntityType,
  translateEnum,
  translateMaintenanceType,
  translateMovementType,
  translatePriority,
  translateStatus,
  translateUnit,
} from '../../../lib/i18n/literals';

type LocalizedValueKind =
  | 'action'
  | 'barcode'
  | 'entity'
  | 'enum'
  | 'maintenanceType'
  | 'movement'
  | 'priority'
  | 'status'
  | 'unit';

interface LocalizedValueProps {
  value: string | null | undefined;
  kind?: LocalizedValueKind;
}

export function LocalizedValue({ value, kind = 'enum' }: LocalizedValueProps) {
  const { locale } = useTranslation();
  const rawValue = value || '';
  const translators: Record<LocalizedValueKind, (input: string, currentLocale: typeof locale) => string> = {
    action: translateAuditAction,
    barcode: translateBarcodeType,
    entity: translateEntityType,
    enum: translateEnum,
    maintenanceType: translateMaintenanceType,
    movement: translateMovementType,
    priority: translatePriority,
    status: translateStatus,
    unit: translateUnit,
  };

  return <>{translators[kind](rawValue, locale)}</>;
}
