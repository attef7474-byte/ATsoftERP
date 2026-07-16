import { ApiPropertyOptional } from '@nestjs/swagger';

export class BaseReportFilterDto {
  @ApiPropertyOptional() dateFrom?: string;
  @ApiPropertyOptional() dateTo?: string;
  @ApiPropertyOptional() companyId?: string;
  @ApiPropertyOptional() branchId?: string;
  @ApiPropertyOptional() departmentId?: string;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional() page?: number = 1;
  @ApiPropertyOptional() pageSize?: number = 20;
  @ApiPropertyOptional() sortBy?: string;
  @ApiPropertyOptional() sortDirection?: 'asc' | 'desc';
}

export class MaintenanceReportFilterDto extends BaseReportFilterDto {
  @ApiPropertyOptional() machineId?: string;
  @ApiPropertyOptional() machineCategoryId?: string;
  @ApiPropertyOptional() maintenanceType?: string;
  @ApiPropertyOptional() priority?: string;
  @ApiPropertyOptional() requestStatus?: string;
  @ApiPropertyOptional() assigneeId?: string;
  @ApiPropertyOptional() dueStatus?: string;
}

export class InventoryReportFilterDto extends BaseReportFilterDto {
  @ApiPropertyOptional() warehouseId?: string;
  @ApiPropertyOptional() locationId?: string;
  @ApiPropertyOptional() productId?: string;
  @ApiPropertyOptional() productCategoryId?: string;
  @ApiPropertyOptional() movementType?: string;
  @ApiPropertyOptional() adjustmentReason?: string;
  @ApiPropertyOptional() countStatus?: string;
  @ApiPropertyOptional() varianceOnly?: boolean;
}

export class BarcodeReportFilterDto extends BaseReportFilterDto {
  @ApiPropertyOptional() entityType?: string;
  @ApiPropertyOptional() scanPurpose?: string;
  @ApiPropertyOptional() result?: string;
  @ApiPropertyOptional() scannedById?: string;
}
