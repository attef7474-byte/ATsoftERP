import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateFinishedGoodsIssueLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  // Canonical transaction unit selection. When set, the base quantity and the
  // conversion snapshot are produced by the single ProductUom conversion
  // authority (never by issue-local arithmetic).
  @IsOptional()
  @IsString()
  productUomId?: string;

  @IsOptional()
  @IsString()
  enteredUnitId?: string;

  // INTERNAL ONLY — never accepted from clients (no class-validator decorator).
  // Declared with the TS `declare` modifier so it is type-only and never emitted
  // as a runtime class field. The reversal flow assigns it dynamically from the
  // source issue's immutable InventoryMovementLine so a reversal replays the
  // exact historical base quantity instead of re-converting with the CURRENT
  // ProductUom factor (historical reversal drift = 0).
  declare historicalQuantityBase?: number;

  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateFinishedGoodsIssueDto {
  @IsString()
  @IsNotEmpty()
  issueWarehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFinishedGoodsIssueLineDto)
  lines!: CreateFinishedGoodsIssueLineDto[];
}

export class UpdateFinishedGoodsIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFinishedGoodsIssueLineDto)
  lines?: CreateFinishedGoodsIssueLineDto[];
}

export class ReverseFinishedGoodsIssueDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelFinishedGoodsIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class RejectFinishedGoodsIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CancelFinishedGoodsIssueApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class WithdrawFinishedGoodsIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class FinishedGoodsIssueQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  issueWarehouseId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
