import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupervisorAssignmentDto {
  @ApiPropertyOptional({
    description: 'Deprecated: company ownership is derived from the active operational context.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ description: 'The assignment being supervised (subordinate)' })
  @IsString()
  assignmentId: string;

  @ApiPropertyOptional({ description: 'The supervisor assignment ID (null = no supervisor)' })
  @IsOptional()
  @IsString()
  supervisorAssignmentId?: string;

  @ApiPropertyOptional({ example: 'DIRECT', enum: ['DIRECT', 'MATRIX', 'FUNCTIONAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['DIRECT', 'MATRIX', 'FUNCTIONAL'])
  relationshipType?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
