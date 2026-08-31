import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { INVENTORY_VALUATION_METHODS } from '../inventory-valuation.constants';

export class UpdateInventoryValuationPolicyDto {
  @ApiPropertyOptional({ enum: INVENTORY_VALUATION_METHODS })
  @IsOptional()
  @IsIn(INVENTORY_VALUATION_METHODS)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currencyCode?: string;
}
