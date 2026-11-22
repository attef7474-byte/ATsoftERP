import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Tenant and authenticated actor never come from this payload. */
export class WorkOrderAssignmentDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  maintenancePersonnelId: string;
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

/**
 * Desired active technician set for a work order. The service computes
 * toAdd / toKeep / toEnd and never hard-deletes assignment history.
 */
export class ReconcileWorkOrderAssignmentsDto {
  @ApiProperty({ description: 'Canonical MaintenancePersonnel ids from the scoped technician lookup', type: [String], maxItems: 50 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  technicianPersonnelIds: string[];

  @ApiPropertyOptional({ description: 'Reason recorded on the scoped audit trail' })
  @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;
}
