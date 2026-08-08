import { PrismaClient } from '@prisma/client';

export const PRODUCTION_ORDER_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_ORDER',
  name: 'Production Order',
  operationName: 'Production Order',
  modelName: 'ProductionOrder',
  domain: 'production',
  prefix: 'PO-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionOrderNumbering(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.numberSequence.findUnique({ where: { code: PRODUCTION_ORDER_NUMBER_SEQUENCE.code } });
  if (!existing) await prisma.numberSequence.create({ data: PRODUCTION_ORDER_NUMBER_SEQUENCE });
}
