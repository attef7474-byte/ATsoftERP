import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { transformValidationErrors } from '../../../../common/validation/validation-error-transformer';
import { QueryInstalledPartLookupDto } from './dto/installed-parts-replacement.dto';

// Mirrors the global ValidationPipe configuration in src/main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: transformValidationErrors(errors),
    }),
});

async function runQuery(query: Record<string, unknown>) {
  return pipe.transform(query, {
    type: 'query',
    metatype: QueryInstalledPartLookupDto,
  }) as Promise<QueryInstalledPartLookupDto>;
}

describe('QueryInstalledPartLookupDto contract (Defect A regression)', () => {
  it('A8 accepts the canonical named query and coerces pagination', async () => {
    const dto = await runQuery({ machineId: 'm1', status: 'ACTIVE', page: '1', limit: '10' });
    expect(dto.machineId).toBe('m1');
    expect(dto.status).toBe('ACTIVE');
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('accepts an empty query (bare lookup)', async () => {
    await expect(runQuery({})).resolves.toBeDefined();
  });

  it('A9 rejects positional keys "0"/"1" as unknown fields', async () => {
    await expect(runQuery({ '0': 'machineId,m1', '1': 'status,ACTIVE' })).rejects.toBeInstanceOf(BadRequestException);
    try {
      await runQuery({ '0': 'machineId,m1', '1': 'status,ACTIVE' });
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as { errors?: { field: string }[] };
      const fields = (response.errors ?? []).map((entry) => entry.field).sort();
      expect(fields).toEqual(['0', '1']);
    }
  });

  it('still rejects an out-of-range limit', async () => {
    await expect(runQuery({ page: '1', limit: '999' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
