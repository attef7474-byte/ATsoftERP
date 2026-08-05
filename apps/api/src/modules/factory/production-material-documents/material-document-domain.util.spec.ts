import {
  isProductionMaterialDocumentType,
  materialDocumentDirection,
  materialDocumentRequiresWarehouse,
  materialMovementType,
  materialReverseType,
} from './material-document-domain.util';

describe('material document domain helpers', () => {
  it('accepts only the four planned document types', () => {
    expect(isProductionMaterialDocumentType('ISSUE')).toBe(true);
    expect(isProductionMaterialDocumentType('CONSUMPTION')).toBe(true);
    expect(isProductionMaterialDocumentType('RETURN')).toBe(true);
    expect(isProductionMaterialDocumentType('SUBSTITUTION')).toBe(true);
    expect(isProductionMaterialDocumentType('TRANSFER')).toBe(false);
    expect(isProductionMaterialDocumentType('')).toBe(false);
  });

  it('maps document types to ledger directions and movement types', () => {
    expect(materialDocumentDirection('ISSUE')).toBe('OUT');
    expect(materialDocumentDirection('CONSUMPTION')).toBe('OUT');
    expect(materialDocumentDirection('SUBSTITUTION')).toBe('OUT');
    expect(materialDocumentDirection('RETURN')).toBe('IN');
    expect(materialMovementType('ISSUE')).toBe('PRODUCTION_ISSUE');
    expect(materialMovementType('CONSUMPTION')).toBe('PRODUCTION_CONSUMPTION');
    expect(materialMovementType('RETURN')).toBe('PRODUCTION_RETURN');
    expect(materialMovementType('SUBSTITUTION')).toBe('PRODUCTION_SUBSTITUTION');
  });

  it('computes the complementary reverse type', () => {
    expect(materialReverseType('ISSUE')).toBe('RETURN');
    expect(materialReverseType('CONSUMPTION')).toBe('RETURN');
    expect(materialReverseType('RETURN')).toBe('ISSUE');
    expect(materialReverseType('SUBSTITUTION')).toBe('SUBSTITUTION');
  });

  it('requires a warehouse for every document type because every document posts an inventory movement', () => {
    expect(materialDocumentRequiresWarehouse('ISSUE')).toBe(true);
    expect(materialDocumentRequiresWarehouse('CONSUMPTION')).toBe(true);
    expect(materialDocumentRequiresWarehouse('RETURN')).toBe(true);
    expect(materialDocumentRequiresWarehouse('SUBSTITUTION')).toBe(true);
  });
});
