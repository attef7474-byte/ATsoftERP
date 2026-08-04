import { PrismaClient } from '@prisma/client';

export const PRODUCTION_RUN_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_RUN',
  name: 'Production Run',
  operationName: 'Production Run',
  modelName: 'ProductionRun',
  domain: 'production',
  prefix: 'RUN-',
  padding: 6,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export const PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE = {
  code: 'PRODUCTION_MEASUREMENT_POINT',
  name: 'Production Measurement Point',
  operationName: 'Production Measurement Point',
  modelName: 'ProductionMeasurementPoint',
  domain: 'production',
  prefix: 'MP-',
  padding: 5,
  scope: 'GLOBAL',
  resetPolicy: 'NEVER',
  status: 'ACTIVE',
};

export async function seedProductionRunNumbering(prisma: PrismaClient): Promise<void> {
  for (const sequence of [PRODUCTION_RUN_NUMBER_SEQUENCE, PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE]) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: sequence.code } });
    if (!existing) await prisma.numberSequence.create({ data: sequence });
  }
}