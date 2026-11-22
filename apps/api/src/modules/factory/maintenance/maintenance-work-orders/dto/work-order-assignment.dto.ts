import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Tenant and authenticated actor never come from this payload. */
export class WorkOrderAssignmentDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  maintenancePersonnelId: string;
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
