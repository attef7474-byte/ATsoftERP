import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostCostTransactionDto } from './cost-transaction.dto';

const UUID = 'cf0b4c0e-9d9f-4b06-8c6a-2e1f8a3b5c7d';

const validPost = {
  clientRequestId: UUID,
  eventType: 'MATERIAL',
  sourceType: 'MANUAL',
  sourceId: 'src-1',
  quantity: 10,
  unit: 'UNIT',
  rate: 5,
  occurredAt: '2026-02-01T08:00:00Z',
};

describe('COST-R1B PostCostTransactionDto', () => {
  it('rejects a costNature outside the allowed canonical set but accepts a valid one', async () => {
    const bad = plainToInstance(PostCostTransactionDto, { ...validPost, costNature: 'GUESSED' });
    const badErrors = await validate(bad, { whitelist: true, forbidNonWhitelisted: true });
    expect(badErrors.some((e) => e.property === 'costNature')).toBe(true);

    const good = plainToInstance(PostCostTransactionDto, { ...validPost, costNature: 'MANUAL_ASSERTED_ACTUAL' });
    expect(await validate(good, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it('enforces entryRole to be exactly PRIMARY_COST or REVERSAL', async () => {
    for (const role of ['PRIMARY_COST', 'REVERSAL']) {
      const ok = plainToInstance(PostCostTransactionDto, { ...validPost, entryRole: role });
      expect(await validate(ok, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    }
    const bad = plainToInstance(PostCostTransactionDto, { ...validPost, entryRole: 'ADJUSTMENT' });
    const errors = await validate(bad, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'entryRole')).toBe(true);
  });

  it('rejects unknown fields (forbidNonWhitelisted mirrors the global ValidationPipe)', async () => {
    const dto = plainToInstance(PostCostTransactionDto, { ...validPost, injectedField: 'x' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'injectedField')).toBe(true);
  });

  it('enforces the required monetary/kernel fields (quantity, rate, occurredAt, clientRequestId)', async () => {
    const missing = plainToInstance(PostCostTransactionDto, {
      quantity: undefined, rate: undefined, occurredAt: undefined, clientRequestId: undefined,
    });
    const errors = await validate(missing, { whitelist: true, forbidNonWhitelisted: true });
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['quantity', 'rate', 'occurredAt', 'clientRequestId']));
  });

  it('rejects adapter-only maintenance labor sources on the generic post contract', async () => {
    const dto = plainToInstance(PostCostTransactionDto, {
      ...validPost,
      eventType: 'LABOR',
      sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'sourceType')).toBe(true);
  });
});
