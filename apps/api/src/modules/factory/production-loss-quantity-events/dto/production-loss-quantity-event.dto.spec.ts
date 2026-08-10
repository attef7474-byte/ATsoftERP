import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CorrectLossDto,
  LossQueryDto,
  RecordLossDto,
} from './production-loss-quantity-event.dto';

const CUID = 'cmrl31uuy0000ok959hdjnca6';

const validRecord = {
  requestId: 'b1f3d2c4-9a8e-4b7f-8c1d-2e3f4a5b6c7d',
  type: 'WASTE',
  quantity: 3.5,
  unit: 'KG',
};

describe('Production loss quantity event DTO CUID contract', () => {
  it('accepts Prisma CUID identifiers on every record-id field (previously rejected by @IsUUID)', async () => {
    const dto = plainToInstance(RecordLossDto, {
      ...validRecord,
      productionRunId: CUID,
      productionOrderId: CUID,
      outputEventId: CUID,
      productionLineId: CUID,
      machineId: CUID,
      measurementPointId: CUID,
      productId: CUID,
      reasonId: CUID,
      sourceEventId: CUID,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a product-only record with a CUID productId and no run context', async () => {
    const dto = plainToInstance(RecordLossDto, { ...validRecord, productId: CUID });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.productId).toBe(CUID);
  });

  it('still rejects a missing required requestId', async () => {
    const { requestId, ...rest } = validRecord;
    const errors = await validate(plainToInstance(RecordLossDto, rest));
    expect(errors.some((e) => e.property === 'requestId')).toBe(true);
  });

  it('still rejects an empty-string requestId (IsNotEmpty preserved)', async () => {
    const errors = await validate(plainToInstance(RecordLossDto, { ...validRecord, requestId: '' }));
    expect(errors.some((e) => e.property === 'requestId')).toBe(true);
  });

  it('keeps optional record-id fields optional', async () => {
    const errors = await validate(plainToInstance(RecordLossDto, validRecord));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID identifiers in the correction DTO', async () => {
    const errors = await validate(plainToInstance(CorrectLossDto, { requestId: validRecord.requestId, reason: 'scrap', reasonId: CUID }));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID identifiers in the list-filter query DTO', async () => {
    const errors = await validate(
      plainToInstance(LossQueryDto, { productionRunId: CUID, productionOrderId: CUID, machineId: CUID, productionLineId: CUID }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string record id type', async () => {
    const errors = await validate(plainToInstance(RecordLossDto, { ...validRecord, productId: 12345 }));
    expect(errors.some((e) => e.property === 'productId')).toBe(true);
  });
});
