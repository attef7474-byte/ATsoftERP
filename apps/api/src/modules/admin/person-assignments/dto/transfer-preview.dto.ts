import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferPreviewDto {
  @ApiProperty({ description: 'New department ID' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({ description: 'New branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'New administration ID' })
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiPropertyOptional({ description: 'New job title ID' })
  @IsOptional()
  @IsString()
  jobTitleId?: string;

  @ApiPropertyOptional({ description: 'New assignment type (default: PRIMARY)' })
  @IsOptional()
  @IsString()
  assignmentType?: string;

  @ApiPropertyOptional({ enum: ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'], description: 'Leadership level for the new assignment' })
  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'])
  leadershipLevel?: string;

  @ApiProperty({ description: 'Transfer effective date' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'End date for the new assignment' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
