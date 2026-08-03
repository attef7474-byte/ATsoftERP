import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductionCapacityStandardDto } from './dto/create-production-capacity-standard.dto';

const valid = {
  productionProductId: 'p1', productionLineId: 'l1', standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
  targetEfficiencyPercent: '90.0000', expectedYieldPercent: '98.0000', sourceType: 'MEASURED', effectiveFrom: '2026-01-01T00:00:00Z',
};

describe('Production capacity DTO contract', () => {
  it('accepts decimal strings without converting business values to JavaScript numbers', async () => {
    const dto = plainToInstance(CreateProductionCapacityStandardDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(typeof dto.standardRate).toBe('string');
  });

  it.each([
    ['standardRate', '1.12345'],
    ['targetEfficiencyPercent', '90.12345'],
    ['expectedYieldPercent', '98.12345'],
  ])('rejects precision beyond four decimals for %s', async (field, value) => {
    const errors = await validate(plainToInstance(CreateProductionCapacityStandardDto, { ...valid, [field]: value }));
    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it('rejects uncontrolled output units and time bases', async () => {
    const errors = await validate(plainToInstance(CreateProductionCapacityStandardDto, { ...valid, outputUnit: 'BOXES', timeBasis: 'SHIFT' }));
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['outputUnit', 'timeBasis']));
  });
});
