import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class WarehouseApprovalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsIn(['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'])
  type?: 'SPARE_PART' | 'RAW_MATERIAL' | 'FINISHED_GOODS';

  @IsOptional()
  @IsIn(['SUBMITTED', 'APPROVED', 'REJECTED'])
  status?: string;

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
