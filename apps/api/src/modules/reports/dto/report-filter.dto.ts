import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BaseReportFilterDto {
  @IsOptional() @ApiPropertyOptional() dateFrom?: string;
  @IsOptional() @ApiPropertyOptional() dateTo?: string;
  @IsOptional() @ApiPropertyOptional() companyId?: string;
  @IsOptional() @ApiPropertyOptional() branchId?: string;
  @IsOptional() @ApiPropertyOptional() departmentId?: string;
  @IsOptional() @ApiPropertyOptional() search?: string;
  @IsOptional() @ApiPropertyOptional() page?: number = 1;
  @IsOptional() @ApiPropertyOptional() pageSize?: number = 20;
  @IsOptional() @ApiPropertyOptional() sortBy?: string;
  @IsOptional() @ApiPropertyOptional() sortDirection?: 'asc' | 'desc';
}

export class MaintenanceReportFilterDto extends BaseReportFilterDto {
  @IsOptional() @ApiPropertyOptional() productionLineId?: string;
  @IsOptional() @ApiPropertyOptional() machineId?: string;
  @IsOptional() @ApiPropertyOptional() machineComponentId?: string;
  @IsOptional() @ApiPropertyOptional() componentId?: string;
  @IsOptional() @ApiPropertyOptional() operationTypeId?: string;
  @IsOptional() @ApiPropertyOptional() costCenterId?: string;
  @IsOptional() @ApiPropertyOptional() sparePartId?: string;
  @IsOptional() @ApiPropertyOptional() machineCategoryId?: string;
  @IsOptional() @ApiPropertyOptional() maintenanceType?: string;
  @IsOptional() @ApiPropertyOptional() priority?: string;
  @IsOptional() @ApiPropertyOptional() requestStatus?: string;
  @IsOptional() @ApiPropertyOptional() assigneeId?: string;
  @IsOptional() @ApiPropertyOptional() dueStatus?: string;
}

export class InventoryReportFilterDto extends BaseReportFilterDto {
  @IsOptional() @ApiPropertyOptional() warehouseId?: string;
  @IsOptional() @ApiPropertyOptional() locationId?: string;
  @IsOptional() @ApiPropertyOptional() productId?: string;
  @IsOptional() @ApiPropertyOptional() productCategoryId?: string;
  @IsOptional() @ApiPropertyOptional() movementType?: string;
  @IsOptional() @ApiPropertyOptional() adjustmentReason?: string;
  @IsOptional() @ApiPropertyOptional() countStatus?: string;
  @IsOptional() @ApiPropertyOptional() varianceOnly?: boolean;
  @IsOptional() @ApiPropertyOptional() direction?: string;
  @IsOptional() @ApiPropertyOptional() sourceType?: string;
  @IsOptional() @ApiPropertyOptional() status?: string;
}

export class BarcodeReportFilterDto extends BaseReportFilterDto {
  @IsOptional() @ApiPropertyOptional() entityType?: string;
  @IsOptional() @ApiPropertyOptional() scanPurpose?: string;
  @IsOptional() @ApiPropertyOptional() result?: string;
  @IsOptional() @ApiPropertyOptional() scannedById?: string;
}

/**
 * Strict query contract for the report export endpoints.
 *
 * Tenant ownership (companyId / branchId) is deliberately NOT declared here.
 * The global ValidationPipe runs with `whitelist: true` and
 * `forbidNonWhitelisted: true`, so a client that tries to supply either value
 * is rejected before it reaches a service. ReportExportService additionally
 * strips those keys as defence in depth. The active operational context is the
 * only authoritative source of tenant and branch scope.
 */
export class ExportReportQueryDto {
  @IsOptional() @IsString() @ApiPropertyOptional() dateFrom?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() dateTo?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() departmentId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @ApiPropertyOptional() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) @ApiPropertyOptional() pageSize?: number;
  @IsOptional() @IsString() @ApiPropertyOptional() sortBy?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() sortDirection?: string;

  @IsOptional() @IsString() @ApiPropertyOptional() productionLineId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() machineId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() machineComponentId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() componentId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() operationTypeId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() costCenterId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() sparePartId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() machineCategoryId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() maintenanceType?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() priority?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() requestStatus?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() assigneeId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() dueStatus?: string;

  @IsOptional() @IsString() @ApiPropertyOptional() warehouseId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() locationId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() productId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() productCategoryId?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() movementType?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() adjustmentReason?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() countStatus?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 1 || value === '1' || value === 'true')
  @IsBoolean()
  @ApiPropertyOptional()
  varianceOnly?: boolean;
  @IsOptional() @IsString() @ApiPropertyOptional() direction?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() sourceType?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() status?: string;

  @IsOptional() @IsString() @ApiPropertyOptional() entityType?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() scanPurpose?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() result?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() scannedById?: string;

  @IsOptional() @IsString() @ApiPropertyOptional() location?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() type?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() entityName?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() entity?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() action?: string;
  @IsOptional() @IsString() @ApiPropertyOptional() userId?: string;
}
