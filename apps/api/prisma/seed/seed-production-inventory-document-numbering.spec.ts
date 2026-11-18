import {
  FINISHED_GOODS_ISSUE_NUMBER_SEQUENCE,
  PRODUCTION_FG_RECEIPT_NUMBER_SEQUENCE,
  PRODUCTION_MATERIAL_DOCUMENT_NUMBER_SEQUENCE,
  seedProductionInventoryDocumentNumbering,
  SPARE_PART_ISSUE_NUMBER_SEQUENCE,
} from './seed-production-inventory-document-numbering';

describe('seedProductionInventoryDocumentNumbering', () => {
  it('owns the approved production, finished-goods and spare-part issue sequences', () => {
    expect(PRODUCTION_MATERIAL_DOCUMENT_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_MATERIAL_DOCUMENT', prefix: 'PMD-', padding: 6, resetPolicy: 'NEVER' }));
    expect(PRODUCTION_FG_RECEIPT_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_FINISHED_GOODS_RECEIPT', prefix: 'PFR-', padding: 6, resetPolicy: 'NEVER' }));
    expect(FINISHED_GOODS_ISSUE_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'FINISHED_GOODS_ISSUE', prefix: 'FGI-', padding: 6, resetPolicy: 'NEVER' }));
    // Standalone spare-part issue numbers are tenant-global, never reset, and
    // bound to the new canonical SparePartIssue model (SPI-000001, ...).
    expect(SPARE_PART_ISSUE_NUMBER_SEQUENCE).toEqual({
      code: 'SPARE_PART_ISSUE',
      name: 'Spare-Part Issue',
      operationName: 'Spare-Part Issue',
      modelName: 'SparePartIssue',
      domain: 'inventory',
      prefix: 'SPI-',
      padding: 6,
      scope: 'GLOBAL',
      resetPolicy: 'NEVER',
      status: 'ACTIVE',
    });
  });

  it('creates only when missing and preserves existing counters', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionInventoryDocumentNumbering(missing);
    expect(create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_MATERIAL_DOCUMENT_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_FG_RECEIPT_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: FINISHED_GOODS_ISSUE_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: SPARE_PART_ISSUE_NUMBER_SEQUENCE });

    const existing: any = {
      numberSequence: {
        findUnique: jest.fn().mockResolvedValue({ code: 'PRODUCTION_MATERIAL_DOCUMENT', currentNumber: 12 }),
        create: jest.fn(),
      },
    };
    await seedProductionInventoryDocumentNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});
