import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AnalyticsInvalidateDto } from './production-analytics/dto/analytics-query.dto';
import {
  AttachTransactionToCalculationDto,
  CreateCostCalculationDto,
} from './production-cost/dto/cost-calculation.dto';
import { CreateCostRateDto } from './production-cost/dto/cost-rate.dto';
import { CreateCostSnapshotDto } from './production-cost/dto/cost-snapshot.dto';
import { PostCostTransactionDto } from './production-cost/dto/cost-transaction.dto';
import { OpenDowntimeDto } from './production-downtime/dto/production-downtime.dto';
import {
  CreateFgReceiptDto,
  CreateFgReceiptLineDto,
} from './production-finished-goods-receipts/dto/production-finished-goods-receipt.dto';
import {
  CreateMaterialDocumentDto,
  CreateMaterialDocumentLineDto,
} from './production-material-documents/dto/production-material-document.dto';
import { RecordMaterialConsumptionDto } from './production-material-requirements/dto/production-material-requirement.dto';
import { CreateInspectionDto } from './production-quality/dto/inspection.dto';
import { CreateNcrDto, NcrAttachDto } from './production-quality/dto/ncr.dto';
import { CreateQualityPlanDto } from './production-quality/dto/quality-plan.dto';

const CUID = 'cmrl31uuy0000ok959hdjnca6';

describe('Production DTO CUID identifier contract (Task 16B)', () => {
  it('accepts CUID scopeId in production analytics invalidation', async () => {
    const errors = await validate(plainToInstance(AnalyticsInvalidateDto, { scopeType: 'RUN', scopeId: CUID, reason: 'recompute' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID ids in production cost DTOs', async () => {
    expect(await validate(plainToInstance(CreateCostCalculationDto, {
      scopeType: 'ORDER', scopeId: CUID, periodFrom: '2026-01-01T00:00:00Z', periodTo: '2026-01-31T00:00:00Z',
    }))).toHaveLength(0);
    expect(await validate(plainToInstance(AttachTransactionToCalculationDto, { transactionId: CUID }))).toHaveLength(0);
    expect(await validate(plainToInstance(CreateCostRateDto, {
      code: 'R1', nameAr: 'ع', nameEn: 'n', costType: 'LABOR', unit: 'HOUR', rate: 10, effectiveFrom: '2026-01-01T00:00:00Z',
      productionLineId: CUID, machineId: CUID, costCenterId: CUID,
    }))).toHaveLength(0);
    expect(await validate(plainToInstance(CreateCostSnapshotDto, {
      code: 'S1', productionProductDefinitionId: CUID, productionVersionId: CUID, productionPackagingId: CUID,
      costType: 'LABOR', unit: 'HOUR', quantity: 1, rate: 5, effectiveFrom: '2026-01-01T00:00:00Z',
    }))).toHaveLength(0);
  });

  it('accepts CUID ids in cost transaction posting while keeping sourceId free-form', async () => {
    const dto = plainToInstance(PostCostTransactionDto, {
      clientRequestId: 'f7e1d3c5-8b2a-4c9e-9d1f-3e4a5b6c7d8e',
      eventType: 'LABOR', sourceType: 'MANUAL', sourceId: 'src-123',
      productionOrderId: CUID, productionRunId: CUID, productId: CUID, shiftId: CUID, costCenterId: CUID,
      quantity: 2, unit: 'HOUR', rate: 25, occurredAt: '2026-01-01T00:00:00Z',
    });
    expect((await validate(dto)).map((e) => e.property)).toEqual([]);
  });

  it('accepts CUID ids in downtime opening', async () => {
    const errors = await validate(plainToInstance(OpenDowntimeDto, {
      requestId: 'b1f3d2c4-9a8e-4b7f-8c1d-2e3f4a5b6c7d',
      productionRunId: CUID, productionOrderId: CUID, shiftId: CUID, productionLineId: CUID, machineId: CUID, reasonId: CUID,
    }));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID ids in finished-goods receipts and keeps required fields required', async () => {
    const missing = await validate(plainToInstance(CreateFgReceiptDto, {
      productionOrderId: CUID, lines: [{ productId: CUID, quantity: 1, unit: 'PC' }],
    }));
    expect(missing.some((e) => e.property === 'productionRunId')).toBe(true);

    const full = plainToInstance(CreateFgReceiptDto, {
      productionOrderId: CUID, productionRunId: CUID, receiptWarehouseId: CUID,
      lines: [plainToInstance(CreateFgReceiptLineDto, { productId: CUID, warehouseLocationId: CUID, quantity: 1, unit: 'PC' })],
    });
    expect(await validate(full)).toHaveLength(0);
  });

  it('rejects an empty productionOrderId in finished-goods receipts (IsNotEmpty preserved)', async () => {
    const errors = await validate(plainToInstance(CreateFgReceiptDto, {
      productionOrderId: '', productionRunId: CUID, lines: [{ productId: CUID, quantity: 1, unit: 'PC' }],
    }));
    expect(errors.some((e) => e.property === 'productionOrderId')).toBe(true);
  });

  it('accepts CUID ids in material documents', async () => {
    const errors = await validate(plainToInstance(CreateMaterialDocumentDto, {
      documentType: 'ISSUE', productionOrderId: CUID, productionRunId: CUID,
      lines: [plainToInstance(CreateMaterialDocumentLineDto, { productId: CUID, warehouseLocationId: CUID, substitutedProductId: CUID, quantity: 1, unit: 'PC' })],
    }));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID ids in material consumption recording', async () => {
    const errors = await validate(plainToInstance(RecordMaterialConsumptionDto, {
      productionOrderId: CUID, productionRunId: CUID, requirementLineId: CUID, productId: CUID, sourceDocumentId: CUID,
      requestId: 'b1f3d2c4-9a8e-4b7f-8c1d-2e3f4a5b6c7d', unit: 'PC', quantity: 5,
    }));
    expect(errors).toHaveLength(0);
  });

  it('accepts CUID ids in production quality DTOs', async () => {
    expect(await validate(plainToInstance(CreateQualityPlanDto, {
      productionProductDefinitionId: CUID, productionVersionId: CUID, productionPackagingId: CUID, productionLineId: CUID,
      effectiveFrom: '2026-01-01T00:00:00Z',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(CreateInspectionDto, {
      planId: CUID, clientRequestId: 'd1e2f3a4-5b6c-7d8e-9f0a-1234567890ab',
      productionOrderId: CUID, productionRunId: CUID, productId: CUID, sampledQuantity: 1, unit: 'UNIT', inspectedAt: '2026-01-01T00:00:00Z',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(CreateNcrDto, {
      clientRequestId: 'b1f3d2c4-9a8e-4b7f-8c1d-2e3f4a5b6c7d', inspectionId: CUID, description: 'defect',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(NcrAttachDto, { attachmentId: CUID }))).toHaveLength(0);
  });

  it('keeps required CUID-backed fields required across representative DTOs', async () => {
    const costSnapshot = await validate(plainToInstance(CreateCostSnapshotDto, {
      code: 'S2', costType: 'LABOR', unit: 'HOUR', quantity: 1, rate: 5, effectiveFrom: '2026-01-01T00:00:00Z',
    }));
    expect(costSnapshot.some((e) => e.property === 'productionProductDefinitionId')).toBe(true);

    const inspection = await validate(plainToInstance(CreateInspectionDto, {
      clientRequestId: 'a5b6c7d8-9e0f-1a2b-3c4d-567890abcdef',
      sampledQuantity: 1, unit: 'PC', inspectedAt: '2026-01-01T00:00:00Z',
    }));
    expect(inspection.some((e) => e.property === 'planId')).toBe(true);

    const materialDoc = await validate(plainToInstance(CreateMaterialDocumentDto, {
      documentType: 'ISSUE', lines: [{ productId: CUID, quantity: 1, unit: 'PC' }],
    }));
    expect(materialDoc.some((e) => e.property === 'productionOrderId')).toBe(true);
    expect(materialDoc.some((e) => e.property === 'productionRunId')).toBe(true);
  });

  it('rejects non-string record-id values (type preservation)', async () => {
    const errors = await validate(plainToInstance(CreateCostCalculationDto, {
      scopeType: 'ORDER', scopeId: 123, periodFrom: '2026-01-01T00:00:00Z', periodTo: '2026-01-31T00:00:00Z',
    }));
    expect(errors.some((e) => e.property === 'scopeId')).toBe(true);
  });
});
