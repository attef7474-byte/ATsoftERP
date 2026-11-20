import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ISSUE_TYPES, LegacyIssueTypeInput } from '../issue-selection.policy';

export class WarehouseApprovalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsIn([...ISSUE_TYPES, 'FINISHED_GOODS'])
  type?: LegacyIssueTypeInput;

  @IsOptional()
  @IsIn(['SUBMITTED', 'APPROVED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  warehouseId?: string;

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
