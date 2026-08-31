import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  INVENTORY_VALUATION_METHODS,
  INVENTORY_VALUATION_METHOD_DEFAULT,
} from '../inventory-valuation.constants';

export class CreateInventoryValuationPolicyDto {
  @ApiProperty() @IsString() @IsNotEmpty() warehouseId!: string;

  @ApiProperty({ enum: INVENTORY_VALUATION_METHODS, default: INVENTORY_VALUATION_METHOD_DEFAULT })
  @IsIn(INVENTORY_VALUATION_METHODS)
  @IsNotEmpty()
  method!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(10) currencyCode!: string;
}
