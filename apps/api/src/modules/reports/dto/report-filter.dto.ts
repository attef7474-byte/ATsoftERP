import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

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
  @IsOptional() @ApiPropertyOptional() machineId?: string;
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
}

export class BarcodeReportFilterDto extends BaseReportFilterDto {
  @IsOptional() @ApiPropertyOptional() entityType?: string;
  @IsOptional() @ApiPropertyOptional() scanPurpose?: string;
  @IsOptional() @ApiPropertyOptional() result?: string;
  @IsOptional() @ApiPropertyOptional() scannedById?: string;
}
