import { PrismaClient } from '@prisma/client';

export const PRODUCTION_CAPACITY_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_CAPACITY_STANDARD',
  name: 'Production Capacity Standard',
  operationName: 'Production Capacity Standard',
  modelName: 'ProductionCapacityStandard',
  domain: 'production',
  prefix: 'PCS-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionCapacityNumbering(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.numberSequence.findUnique({ where: { code: PRODUCTION_CAPACITY_NUMBER_SEQUENCE.code } });
  if (!existing) await prisma.numberSequence.create({ data: PRODUCTION_CAPACITY_NUMBER_SEQUENCE });
}
