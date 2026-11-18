import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

/**
 * A line selects the canonical SparePart master. `productId` is accepted only
 * so a client can assert the expected linked Product; the service always
 * resolves the authoritative productId from SparePart.productId and rejects a
 * mismatch (whitelist-safe: every client-settable field has a validator).
 */
export class CreateSparePartIssueLineDto {
  @IsString()
  @IsNotEmpty()
  sparePartId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  /** Transaction UOM snapshot; canonical conversion is owned by InventoryMovementsService. */
  @IsOptional()
  @IsString()
  productUomId?: string;

  @IsOptional()
  @IsString()
  enteredUnitId?: string;

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

export class CreateSparePartIssueDto {
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
  @Type(() => CreateSparePartIssueLineDto)
  lines!: CreateSparePartIssueLineDto[];
}

export class UpdateSparePartIssueDto {
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
  @Type(() => CreateSparePartIssueLineDto)
  lines?: CreateSparePartIssueLineDto[];
}

export class WithdrawSparePartIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RejectSparePartIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CancelSparePartIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CancelSparePartIssueApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class SparePartIssueQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  /** Scoped to the active context; maps to the header's issueWarehouseId. */
  @IsOptional()
  @IsString()
  warehouseId?: string;

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
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestId?: string;
}
