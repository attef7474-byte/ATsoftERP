import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EntityType {
  COMPANY = 'company',
  BRANCH = 'branch',
  ADMINISTRATION = 'administration',
  DEPARTMENT = 'department',
  WAREHOUSE = 'warehouse',
  WAREHOUSE_LOCATION = 'warehouseLocation',
  PRODUCT = 'product',
  MACHINE = 'machine',
  USER = 'user',
  ROLE = 'role',
  MAINTENANCE_REQUEST = 'maintenanceRequest',
  INVENTORY_COUNT = 'inventoryCount',
  PRODUCTION_LINE = 'productionLine',
  PRODUCTION_ORDER = 'productionOrder',
  COST_CENTER = 'costCenter',
  OPERATION_TYPE = 'operationType',
  MACHINE_COMPONENT = 'machineComponent',
  COMPONENT = 'component',
  SPARE_PART = 'sparePart',
  PRODUCTION_QUALITY_PLAN = 'productionQualityPlan',
  PRODUCTION_INSPECTION = 'productionInspection',
  PRODUCTION_NCR = 'productionNcr',
  OPERATIONAL_COST_RATE = 'operationalCostRate',
  OPERATIONAL_COST_SNAPSHOT = 'operationalCostSnapshot',
}

export const SEARCHABLE_ENTITY_TYPES: EntityType[] = [
  EntityType.COMPANY,
  EntityType.BRANCH,
  EntityType.ADMINISTRATION,
  EntityType.DEPARTMENT,
  EntityType.WAREHOUSE,
  EntityType.WAREHOUSE_LOCATION,
  EntityType.PRODUCT,
  EntityType.MACHINE,
  EntityType.USER,
  EntityType.ROLE,
  EntityType.MAINTENANCE_REQUEST,
  EntityType.INVENTORY_COUNT,
  EntityType.PRODUCTION_LINE,
  EntityType.PRODUCTION_ORDER,
  EntityType.COST_CENTER,
  EntityType.OPERATION_TYPE,
  EntityType.MACHINE_COMPONENT,
  EntityType.SPARE_PART,
  EntityType.PRODUCTION_QUALITY_PLAN,
  EntityType.PRODUCTION_INSPECTION,
  EntityType.PRODUCTION_NCR,
  EntityType.OPERATIONAL_COST_RATE,
  EntityType.OPERATIONAL_COST_SNAPSHOT,
];

export class SearchEntityFilters {
  @ApiPropertyOptional({ description: 'Narrow results to an administration inside the active context' })
  @IsString()
  @IsOptional()
  administrationId?: string;

  @ApiPropertyOptional({ description: 'Narrow results to a department inside the active context' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Narrow locations/products/spare parts to a warehouse inside the active context' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Narrow maintenance results to a machine inside the active context' })
  @IsString()
  @IsOptional()
  machineId?: string;

  @ApiPropertyOptional({ description: 'Narrow maintenance results to a machine component' })
  @IsString()
  @IsOptional()
  machineComponentId?: string;

  @ApiPropertyOptional({ description: 'Alias for machineComponentId' })
  @IsString()
  @IsOptional()
  componentId?: string;

  @ApiPropertyOptional({ description: 'Narrow maintenance results to a production line' })
  @IsString()
  @IsOptional()
  productionLineId?: string;

  @ApiPropertyOptional({ description: 'Narrow maintenance results to an operation type' })
  @IsString()
  @IsOptional()
  operationTypeId?: string;

  @ApiPropertyOptional({ description: 'Narrow maintenance results to a cost center' })
  @IsString()
  @IsOptional()
  costCenterId?: string;
}

export class UnifiedSearchQueryDto extends SearchEntityFilters {
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

export class EntitySearchQueryDto extends SearchEntityFilters {
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

export class LookupRequestDto extends SearchEntityFilters {
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
