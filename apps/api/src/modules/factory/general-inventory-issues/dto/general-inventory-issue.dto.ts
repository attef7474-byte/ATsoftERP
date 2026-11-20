import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateGeneralInventoryIssueLineDto {
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

  /** Canonical transaction-UOM selection resolved by ProductUom authority. */
  @IsOptional()
  @IsString()
  productUomId?: string;

  /** Entered-unit scalar snapshot carried by the movement conversion authority. */
  @IsOptional()
  @IsString()
  enteredUnitId?: string;

  // INTERNAL ONLY — never accepted from clients (no class-validator decorator).
  // Declared with `declare` so it is type-only and never emitted as a runtime
  // field. The reversal flow assigns it from the source's immutable
  // InventoryMovementLine so the IN reversal replays the exact historical base
  // quantity instead of re-converting with the CURRENT ProductUom factor.
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

export class CreateGeneralInventoryIssueDto {
  @IsString()
  @IsNotEmpty()
  issueWarehouseId!: string;

  @IsIn(['PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL'])
  issueType!: 'PACKAGING_MATERIAL' | 'CONSUMABLE' | 'GENERAL';

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
  @Type(() => CreateGeneralInventoryIssueLineDto)
  lines!: CreateGeneralInventoryIssueLineDto[];
}

export class UpdateGeneralInventoryIssueDto {
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
  @Type(() => CreateGeneralInventoryIssueLineDto)
  lines?: CreateGeneralInventoryIssueLineDto[];
}

export class GeneralInventoryIssueQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReverseGeneralInventoryIssueDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelGeneralInventoryIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class RejectGeneralInventoryIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CancelGeneralInventoryIssueApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class WithdrawGeneralInventoryIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
