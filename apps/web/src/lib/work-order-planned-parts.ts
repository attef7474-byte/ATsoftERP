/** Draft-only fields never enter the API payload or a saved-order PATCH. */
export interface PlannedPartDraft {
  clientKey: string;
  sparePartId: string;
  productId: string;
  quantity: string;
  unit: string;
  unitCost: string;
  notes: string;
}

export function validatePlannedParts(parts: PlannedPartDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  parts.forEach((part, index) => {
    if (!part.sparePartId && !part.productId) errors['parts.' + index + '.sparePartId'] = 'validation.required';
    if (!part.quantity.trim() || !Number.isFinite(Number(part.quantity)) || Number(part.quantity) < 0.0001) {
      errors['parts.' + index + '.quantity'] = 'validation.invalidQuantity';
    }
    if (part.unitCost.trim() && (!Number.isFinite(Number(part.unitCost)) || Number(part.unitCost) < 0)) {
      errors['parts.' + index + '.unitCost'] = 'validation.number';
    }
  });
  return errors;
}

/** Use the existing nested create so the order and its planned lines save together. */
export function plannedPartsPayload(parts: PlannedPartDraft[], mode: 'create' | 'edit') {
  if (mode === 'edit' || parts.length === 0) return {};
  return {
    parts: parts.map(part => ({
      ...(part.sparePartId ? { sparePartId: part.sparePartId } : {}),
      ...(part.productId ? { productId: part.productId } : {}),
      quantity: Number(part.quantity),
      ...(part.unit.trim() ? { unit: part.unit.trim() } : {}),
      ...(part.unitCost.trim() ? { unitCost: Number(part.unitCost) } : {}),
      ...(part.notes.trim() ? { notes: part.notes.trim() } : {}),
    })),
  };
}
