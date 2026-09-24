import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWorkOrderFromRequestDto } from './create-work-order-from-request.dto';

describe('CreateWorkOrderFromRequestDto (R2-C canonical server-derived link)', () => {
  const validDto = { title: 'Fix pump' };

  it('validates a normal payload', async () => {
    const dto = plainToInstance(CreateWorkOrderFromRequestDto, validDto);
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it.each(['requestId', 'machineId'])('rejects a client-supplied %s field (server-derived)', async (field) => {
    const dto = plainToInstance(CreateWorkOrderFromRequestDto, { ...validDto, [field]: 'forged' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === field && e.constraints?.whitelistValidation)).toBe(true);
  });

  it('requires a title', async () => {
    const dto = plainToInstance(CreateWorkOrderFromRequestDto, {});
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});