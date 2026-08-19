import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonAssignmentDto {
  @ApiPropertyOptional({
    description: 'Deprecated: company ownership is derived from the active operational context and never trusted from the client.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiProperty({ description: 'Department ID (required)' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Job Title ID' })
  @IsOptional()
  @IsString()
  jobTitleId?: string;

  @ApiProperty({ description: 'OperationalPerson ID' })
  @IsString()
  personnelId: string;

  @ApiPropertyOptional({ example: 'PRIMARY', enum: ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'] })
  @IsOptional()
  @IsString()
  @IsIn(['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'])
  assignmentType?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
