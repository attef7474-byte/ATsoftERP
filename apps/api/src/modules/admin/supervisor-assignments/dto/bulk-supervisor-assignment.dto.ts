import { IsString, IsOptional, IsDateString, IsArray, IsIn, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const BULK_MAX_SIZE = 200;

export class BulkSupervisorAssignmentDto {
  @ApiProperty({ description: 'The supervisor assignment ID (OperationalPersonAssignment)' })
  @IsString()
  supervisorAssignmentId: string;

  @ApiPropertyOptional({ example: 'DIRECT', enum: ['DIRECT'], description: 'Only DIRECT is supported for bulk operations' })
  @IsOptional()
  @IsString()
  @IsIn(['DIRECT'])
  relationshipType?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({ description: 'Array of subordinate assignment IDs (max 200)', type: [String], minLength: 1, maxLength: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_SIZE)
  @IsString({ each: true })
  assignmentIds: string[];
}
