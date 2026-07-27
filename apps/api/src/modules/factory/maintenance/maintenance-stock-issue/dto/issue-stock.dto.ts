import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueStockDto {
  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  issuedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnStockDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  returnQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
