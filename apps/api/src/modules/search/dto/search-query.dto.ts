import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EntityType {
  COMPANY = 'company',
  BRANCH = 'branch',
  DEPARTMENT = 'department',
  WAREHOUSE = 'warehouse',
  WAREHOUSE_LOCATION = 'warehouseLocation',
  PRODUCT = 'product',
  MACHINE = 'machine',
  USER = 'user',
  ROLE = 'role',
  MAINTENANCE_REQUEST = 'maintenanceRequest',
  INVENTORY_COUNT = 'inventoryCount',
}

export class UnifiedSearchQueryDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: EntityType, isArray: true })
  @IsEnum(EntityType, { each: true })
  @IsOptional()
  types?: EntityType[];

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class EntitySearchQueryDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class LookupRequestDto {
  @ApiPropertyOptional({ description: 'Entity type to look up' })
  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType;

  @ApiPropertyOptional({ description: 'Entity ID' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @IsOptional()
  q?: string;
}
