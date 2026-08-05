import { PrismaClient } from '@prisma/client';

export const PRODUCTION_MATERIAL_DOCUMENT_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_MATERIAL_DOCUMENT',
  name: 'Production Material Document',
  operationName: 'Production Material Document',
  modelName: 'ProductionMaterialDocument',
  domain: 'production',
  prefix: 'PMD-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export const PRODUCTION_FG_RECEIPT_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_FINISHED_GOODS_RECEIPT',
  name: 'Production Finished-Goods Receipt',
  operationName: 'Production Finished-Goods Receipt',
  modelName: 'ProductionFinishedGoodsReceipt',
  domain: 'production',
  prefix: 'PFR-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionInventoryDocumentNumbering(prisma: PrismaClient): Promise<void> {
  for (const sequence of [PRODUCTION_MATERIAL_DOCUMENT_NUMBER_SEQUENCE, PRODUCTION_FG_RECEIPT_NUMBER_SEQUENCE]) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: sequence.code } });
    if (!existing) await prisma.numberSequence.create({ data: sequence });
  }
}
