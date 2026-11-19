import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RECEIPT_SOURCES, RECEIPT_TYPES } from '../../inventory-operational-receipts/receipt-type.domain';

export const UNIFIED_RECEIPT_AUTHORITIES = ['OPERATIONAL', 'PRODUCTION_FG'] as const;

export class UnifiedReceiptQueryDto {
  @ApiPropertyOptional({ enum: RECEIPT_TYPES })
  @IsOptional()
  @IsIn(RECEIPT_TYPES)
  receiptType?: string;

  @ApiPropertyOptional({ enum: RECEIPT_SOURCES })
  @IsOptional()
  @IsIn(RECEIPT_SOURCES)
  receiptSource?: string;

  @ApiPropertyOptional({ enum: UNIFIED_RECEIPT_AUTHORITIES })
  @IsOptional()
  @IsIn(UNIFIED_RECEIPT_AUTHORITIES)
  authority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionRunId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
