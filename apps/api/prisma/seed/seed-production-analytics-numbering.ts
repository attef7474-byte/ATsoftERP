import { PrismaClient } from '@prisma/client';

export const PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_PERFORMANCE_TARGET',
  name: 'Production Performance Target',
  operationName: 'Production Performance Target',
  modelName: 'ProductionPerformanceTarget',
  domain: 'production',
  prefix: 'PPT-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionAnalyticsNumbering(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.numberSequence.findUnique({ where: { code: PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE.code } });
  if (!existing) await prisma.numberSequence.create({ data: PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE });
}
