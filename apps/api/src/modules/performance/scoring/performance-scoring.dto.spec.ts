import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePerformanceTargetDto, CreatePerformanceWeightDto, CreatePerformanceScoringRuleDto } from './dto/performance-scoring.dto';

async function validateDto(cls: any, obj: any) {
  const inst = plainToInstance(cls, obj);
  return validate(inst as object, { whitelist: true, forbidNonWhitelisted: true });
}

describe('Phase 3 DTO mass-assignment protection', () => {
  const systemForbidden = ['companyId', 'createdById', 'updatedById', 'revision', 'supersedesId', 'status', 'deletedAt', 'id'];

  it('rejects forbidden/system fields on target create (branchId is legitimate scope field)', async () => {
    for (const f of systemForbidden) {
      const errors = await validateDto(CreatePerformanceTargetDto, { kpiDefinitionId: 'k1', scopeType: 'COMPANY', targetValue: 80, effectiveFrom: '2026-01-01T00:00:00Z', [f]: 'x' });
      const msgs = errors.flatMap(e => Object.values(e.constraints || {})).map(String).join(' ');
      const ok = errors.some(e => e.property === f) || /should not exist|whitelist/i.test(msgs);
      expect(ok).toBe(true);
    }
    // branchId is a legitimate target scope field - must be accepted, not rejected
    const okErrors = await validateDto(CreatePerformanceTargetDto, { kpiDefinitionId: 'k1', scopeType: 'BRANCH', branchId: 'b1', targetValue: 80, effectiveFrom: '2026-01-01T00:00:00Z' });
    expect(okErrors.some(e => e.property === 'branchId')).toBe(false);
  });

  it('rejects forbidden/system fields on weight create', async () => {
    const forbidden = [...systemForbidden, 'branchId'];
    for (const f of forbidden) {
      const errors = await validateDto(CreatePerformanceWeightDto, { performanceProfileId: 'p1', kpiDefinitionId: 'k1', weightPercent: 10, effectiveFrom: '2026-01-01T00:00:00Z', [f]: 'x' });
      const msgs = errors.flatMap(e => Object.values(e.constraints || {})).map(String).join(' ');
      const ok = errors.some(e => e.property === f) || /should not exist|whitelist/i.test(msgs);
      expect(ok).toBe(true);
    }
  });

  it('rejects forbidden/system fields on rule create', async () => {
    const forbidden = [...systemForbidden, 'branchId'];
    for (const f of forbidden) {
      const errors = await validateDto(CreatePerformanceScoringRuleDto, { kpiDefinitionId: 'k1', scoringMode: 'LINEAR_TARGET', direction: 'HIGHER_IS_BETTER', effectiveFrom: '2026-01-01T00:00:00Z', [f]: 'x' });
      const msgs = errors.flatMap(e => Object.values(e.constraints || {})).map(String).join(' ');
      const ok = errors.some(e => e.property === f) || /should not exist|whitelist/i.test(msgs);
      expect(ok).toBe(true);
    }
  });

  it('rejects weight < 0 and > 100', async () => {
    const e1 = await validateDto(CreatePerformanceWeightDto, { performanceProfileId: 'p1', kpiDefinitionId: 'k1', weightPercent: -1, effectiveFrom: '2026-01-01T00:00:00Z' });
    const e2 = await validateDto(CreatePerformanceWeightDto, { performanceProfileId: 'p1', kpiDefinitionId: 'k1', weightPercent: 101, effectiveFrom: '2026-01-01T00:00:00Z' });
    expect(e1.length).toBeGreaterThan(0);
    expect(e2.length).toBeGreaterThan(0);
  });
});
