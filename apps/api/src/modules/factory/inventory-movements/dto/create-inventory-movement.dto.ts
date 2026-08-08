import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsDateString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInventoryMovementLineDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ description: 'Decimal shadow of quantity (phase 1.7 precision conversion)' })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantityBase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsString()
  direction: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInventoryMovementDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty()
  @IsString()
  movementType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Idempotency token scoped to the active company and branch. Reusing the same requestId with identical data returns the same movement; with different data it is rejected with a conflict.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateInventoryMovementLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryMovementLineDto)
  lines: CreateInventoryMovementLineDto[];
}
