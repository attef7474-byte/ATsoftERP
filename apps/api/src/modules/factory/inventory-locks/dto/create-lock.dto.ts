import { IsString, IsOptional, IsDateString, IsIn, MinLength, MaxLength } from 'class-validator'

export class CreateInventoryLockDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  code: string

  @IsString()
  @IsIn(['PERIOD_LOCK', 'WAREHOUSE_LOCK', 'LOCATION_LOCK', 'ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK'])
  lockType: string

  @IsDateString()
  dateFrom: string

  @IsDateString()
  dateTo: string

  @IsOptional()
  @IsString()
  warehouseId?: string

  @IsOptional()
  @IsString()
  locationId?: string

  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsString()
  sparePartId?: string

  @IsString()
  @MinLength(5)
  reason: string

  @IsOptional()
  @IsString()
  notes?: string
}
