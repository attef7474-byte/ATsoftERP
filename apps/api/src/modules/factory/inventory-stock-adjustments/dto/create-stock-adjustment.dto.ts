import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min, ArrayMinSize, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockAdjustmentLineDto {
  @ApiProperty() @IsString() productId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationId?: string;
  @ApiProperty({ enum: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] })
  @IsString() @IsIn(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']) adjustmentType: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  // VAL-R1D: authoritative cost source for an ADJUSTMENT_IN into an ACTIVE
  // valuation warehouse (requires the valuation cost-input permission; currency
  // must equal the ACTIVE policy currency). Ignored for ADJUSTMENT_OUT, which
  // revalues at the current moving average.
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currencyCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valuationReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateStockAdjustmentDto {
  @ApiProperty() @IsString() companyId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiProperty() @IsString() warehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [CreateStockAdjustmentLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateStockAdjustmentLineDto)
  lines: CreateStockAdjustmentLineDto[];
}
