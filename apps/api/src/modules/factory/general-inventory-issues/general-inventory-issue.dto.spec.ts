import { ValidationPipe } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CancelGeneralInventoryIssueApprovalDto,
  CancelGeneralInventoryIssueDto,
  CreateGeneralInventoryIssueDto,
  CreateGeneralInventoryIssueLineDto,
  GeneralInventoryIssueQueryDto,
  RejectGeneralInventoryIssueDto,
  ReverseGeneralInventoryIssueDto,
  UpdateGeneralInventoryIssueDto,
  WithdrawGeneralInventoryIssueDto,
} from './dto/general-inventory-issue.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

const validCreate = () => ({
  issueWarehouseId: 'wh1',
  issueType: 'GENERAL',
  requestId: '9d7e8a3c-1b2d-4f5a-8c9e-0a1b2c3d4e5f',
  lines: [{ productId: 'prod1', quantity: 2.5, unit: 'PC' }],
});

const createDto = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(CreateGeneralInventoryIssueDto, { ...validCreate(), ...overrides });

describe('General inventory issue DTO boundaries', () => {
  describe('issue type allow-list', () => {
    it.each(['PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL'])('accepts %s', (issueType) => {
      expect(validateSync(createDto({ issueType }))).toHaveLength(0);
    });

    it.each(['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOOD', null, undefined, '', 'general'])(
      'rejects %s (including null/unclassified and mismatched types)',
      (issueType) => {
        expect(validateSync(createDto({ issueType }))).toEqual(
          expect.arrayContaining([expect.objectContaining({ property: 'issueType' })]),
        );
      },
    );

    it('rejects a missing issueType', () => {
      const { issueType: _ignored, ...rest } = validCreate();
      const dto = plainToInstance(CreateGeneralInventoryIssueDto, rest);
      expect(validateSync(dto)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'issueType' })]));
    });
  });

  describe('quantity and unit', () => {
    it.each([0, -1, -0.0001])('rejects non-positive quantity %s', (quantity) => {
      const dto = Object.assign(new CreateGeneralInventoryIssueLineDto(), { productId: 'prod1', quantity, unit: 'PC' });
      expect(validateSync(dto)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'quantity' })]));
    });

    it.each([1.12345, 0.00001, 10.00009])('rejects quantity with more than four decimals %s', (quantity) => {
      const dto = Object.assign(new CreateGeneralInventoryIssueLineDto(), { productId: 'prod1', quantity, unit: 'PC' });
      expect(validateSync(dto)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'quantity' })]));
    });

    it('accepts exactly four decimals and rejects a unit longer than 50 characters', () => {
      expect(validateSync(Object.assign(new CreateGeneralInventoryIssueLineDto(), {
        productId: 'prod1', quantity: 0.0001, unit: 'PC',
      }))).toHaveLength(0);
      expect(validateSync(Object.assign(new CreateGeneralInventoryIssueLineDto(), {
        productId: 'prod1', quantity: 1, unit: 'x'.repeat(51),
      }))).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'unit' })]));
    });
  });

  describe('nested lines', () => {
    it('rejects an empty lines array', () => {
      expect(validateSync(createDto({ lines: [] }))).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'lines' })]),
      );
    });

    it('rejects an invalid nested line via class-transformer', () => {
      const dto = plainToInstance(CreateGeneralInventoryIssueDto, {
        ...validCreate(),
        lines: [{ productId: 'prod1', quantity: -1, unit: 'PC' }],
      });
      expect(validateSync(dto)).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'lines' })]),
      );
      expect(dto.lines[0]).toBeInstanceOf(CreateGeneralInventoryIssueLineDto);
    });

    it('accepts nested optional line fields', () => {
      const dto = plainToInstance(CreateGeneralInventoryIssueDto, {
        ...validCreate(),
        lines: [{
          productId: 'prod1',
          quantity: 1.25,
          unit: 'BOX',
          productUomId: 'uom1',
          enteredUnitId: 'unit1',
          warehouseLocationId: 'loc1',
          batchNumber: 'B1',
          serialNumber: 'S1',
          expiryDate: '2026-12-31T00:00:00.000Z',
          notes: 'note',
        }],
      });
      expect(validateSync(dto)).toHaveLength(0);
    });
  });

  describe('unknown-field rejection via ValidationPipe', () => {
    it('rejects client-supplied tenant, identity and immutable fields on create', async () => {
      for (const field of ['companyId', 'branchId', 'createdById', 'status', 'movementId', 'issueNumber', 'historicalQuantityBase']) {
        await expect(
          pipe.transform({ ...validCreate(), [field]: 'foreign' }, { type: 'body', metatype: CreateGeneralInventoryIssueDto }),
        ).rejects.toMatchObject({ status: 400 });
      }
    });

    it('rejects issueType and issueWarehouseId changes on update', async () => {
      for (const field of ['issueType', 'issueWarehouseId', 'companyId', 'status']) {
        await expect(
          pipe.transform({ notes: 'x', [field]: 'foreign' }, { type: 'body', metatype: UpdateGeneralInventoryIssueDto }),
        ).rejects.toMatchObject({ status: 400 });
      }
    });

    it('accepts a valid update payload', async () => {
      const result: any = await pipe.transform(
        { purpose: 'p', issueDate: '2026-03-01T10:00:00.000Z', notes: 'n', lines: validCreate().lines },
        { type: 'body', metatype: UpdateGeneralInventoryIssueDto },
      );
      expect(result.lines[0]).toBeInstanceOf(CreateGeneralInventoryIssueLineDto);
      expect(validateSync(result)).toHaveLength(0);
    });
  });

  describe('transition DTOs', () => {
    it('requires a reason to reject, cancel and cancel a prior approval', () => {
      for (const Dto of [RejectGeneralInventoryIssueDto, CancelGeneralInventoryIssueDto, CancelGeneralInventoryIssueApprovalDto]) {
        expect(validateSync(Object.assign(new Dto(), {}))).toEqual(
          expect.arrayContaining([expect.objectContaining({ property: 'reason' })]),
        );
        expect(validateSync(Object.assign(new Dto(), { reason: 'valid reason' }))).toHaveLength(0);
      }
    });

    it('allows an optional reason on withdraw and optional requestId/notes on reverse', () => {
      expect(validateSync(Object.assign(new WithdrawGeneralInventoryIssueDto(), {}))).toHaveLength(0);
      expect(validateSync(Object.assign(new ReverseGeneralInventoryIssueDto(), {
        requestId: '9d7e8a3c-1b2d-4f5a-8c9e-0a1b2c3d4e5f',
        notes: 'compensating entry',
      }))).toHaveLength(0);
    });

    it('rejects a non-UUID reverse requestId', () => {
      const dto = Object.assign(new ReverseGeneralInventoryIssueDto(), { requestId: 'not-a-uuid' });
      expect(validateSync(dto)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'requestId' })]));
    });
  });

  describe('query DTO', () => {
    it('accepts the documented filters', () => {
      const dto = plainToInstance(GeneralInventoryIssueQueryDto, {
        page: 1,
        limit: 20,
        warehouseId: 'wh1',
        status: 'POSTED',
        issueType: 'GENERAL',
        dateFrom: '2026-01-01T00:00:00.000Z',
        dateTo: '2026-12-31T00:00:00.000Z',
        search: 'GIS-',
        requestId: 'req1',
      });
      expect(validateSync(dto)).toHaveLength(0);
    });
  });
});
