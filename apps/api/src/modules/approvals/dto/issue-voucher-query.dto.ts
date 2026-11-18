import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IssueType } from '../issue-selection.policy';
export class IssueVoucherQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @IsOptional()
  @IsIn(['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'])
  type?: IssueType;
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'REQUESTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED', 'RESERVED', 'USED'])
  status?: string;
  @IsOptional()
  @IsString()
  warehouseId?: string;
  @IsOptional()
  @IsString()
  requesterId?: string;
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  @IsOptional()
  @IsDateString()
  dateTo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
class IssueLookupPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class IssueWarehouseQueryDto extends IssueLookupPageDto {
  @IsOptional()
  @IsIn(['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'])
  type?: IssueType;
}
export class IssueCandidateQueryDto extends IssueLookupPageDto {
  @IsIn(['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'])
  type!: IssueType;
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;
  @IsOptional()
  @IsString()
  productionOrderId?: string;
  @IsOptional()
  @IsString()
  productionRunId?: string;
  @IsOptional()
  @IsString()
  productId?: string;
  @IsOptional()
  @IsString()
  locationId?: string;
  @IsOptional()
  @IsString()
  batchNumber?: string;
  @IsOptional()
  @IsString()
  serialNumber?: string;
}
