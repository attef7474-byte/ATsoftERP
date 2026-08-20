import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CandidateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitleId?: string;

  @ApiPropertyOptional({ enum: ['PRIMARY', 'SECONDARY', 'ADHOC'] })
  @IsOptional()
  @IsString()
  @IsIn(['PRIMARY', 'SECONDARY', 'ADHOC'])
  assignmentType?: string;

  @ApiPropertyOptional({ description: 'Exclude candidates who already have a direct supervisor' })
  @IsOptional()
  @IsString()
  withoutCurrentDirectSupervisor?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsString()
  limit?: string;
}
