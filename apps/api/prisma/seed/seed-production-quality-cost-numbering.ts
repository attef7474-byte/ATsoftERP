import { PrismaClient } from '@prisma/client';

export const PRODUCTION_QUALITY_PLAN_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_QUALITY_PLAN',
  name: 'Production Quality Plan',
  operationName: 'Production Quality Plan',
  modelName: 'ProductionQualityPlan',
  domain: 'production',
  prefix: 'PQP-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export const PRODUCTION_INSPECTION_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_INSPECTION',
  name: 'Production Inspection',
  operationName: 'Production Inspection',
  modelName: 'ProductionInspection',
  domain: 'production',
  prefix: 'PIN-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export const PRODUCTION_NCR_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_NCR',
  name: 'Production Nonconformance Report',
  operationName: 'Production Nonconformance Report',
  modelName: 'ProductionNonconformance',
  domain: 'production',
  prefix: 'NCR-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export const PRODUCTION_COST_CALCULATION_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_COST_CALCULATION',
  name: 'Production Cost Calculation',
  operationName: 'Production Cost Calculation',
  modelName: 'OperationalCostCalculation',
  domain: 'production',
  prefix: 'OCC-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionQualityCostNumbering(prisma: PrismaClient): Promise<void> {
  for (const sequence of [
    PRODUCTION_QUALITY_PLAN_NUMBER_SEQUENCE,
    PRODUCTION_INSPECTION_NUMBER_SEQUENCE,
    PRODUCTION_NCR_NUMBER_SEQUENCE,
    PRODUCTION_COST_CALCULATION_NUMBER_SEQUENCE,
  ]) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: sequence.code } });
    if (!existing) await prisma.numberSequence.create({ data: sequence });
  }
}
