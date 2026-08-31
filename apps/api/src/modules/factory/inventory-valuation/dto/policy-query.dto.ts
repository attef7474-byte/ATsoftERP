import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { INVENTORY_VALUATION_POLICY_STATUSES } from '../inventory-valuation.constants';

export class InventoryValuationPolicyQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional({ enum: INVENTORY_VALUATION_POLICY_STATUSES })
  @IsOptional()
  @IsIn(INVENTORY_VALUATION_POLICY_STATUSES)
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
