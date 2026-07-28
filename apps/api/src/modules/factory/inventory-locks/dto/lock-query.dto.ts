import { IsOptional, IsString, IsIn, IsDateString, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class LockQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE', 'PERIOD_LOCK', 'WAREHOUSE_LOCK', 'LOCATION_LOCK', 'ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK'])
  status?: string

  @IsOptional()
  @IsString()
  lockType?: string

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
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20
}

export class LockCheckDto {
  @IsDateString()
  date: string

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

  @IsOptional()
  @IsString()
  operationType?: string
}
