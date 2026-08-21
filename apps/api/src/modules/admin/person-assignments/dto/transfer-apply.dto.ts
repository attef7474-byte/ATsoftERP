import { IsString, IsIn, IsOptional, IsDateString, ValidateNested, ArrayUnique, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RelationshipResolutionDto {
  @ApiProperty({ description: 'SupervisorAssignment relationship ID to resolve' })
  @IsString()
  relationshipId: string;

  @ApiProperty({ enum: ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'], description: 'Resolution action' })
  @IsString()
  @IsIn(['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'])
  action: 'END_AT_TRANSFER' | 'CONTINUE_ON_NEW_ASSIGNMENT';
}

export class TransferApplyDto {
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
  @IsIn(['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'])
  assignmentType?: string;

  @ApiPropertyOptional({ enum: ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'], description: 'Leadership level for the new assignment (defaults to NONE)' })
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

  @ApiPropertyOptional({ type: [RelationshipResolutionDto], description: 'Required resolutions for affected relationships. Optional when no supervision relationships are affected.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayUnique((r: RelationshipResolutionDto) => r.relationshipId)
  @Type(() => RelationshipResolutionDto)
  relationshipResolutions?: RelationshipResolutionDto[];
}
