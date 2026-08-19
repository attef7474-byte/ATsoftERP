import { IsString, IsOptional, IsDateString, IsInt, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const HANDOVER_STATUSES = ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'] as const;

export const HANDOVER_ITEM_CATEGORIES = [
  'MAINTENANCE_REQUEST',
  'STOPPED_MACHINE',
  'PRODUCTION_ORDER',
  'QUALITY_ISSUE',
  'MATERIAL_SHORTAGE',
  'SAFETY_OBSERVATION',
  'GENERAL',
] as const;

export const HANDOVER_ITEM_ENTITY_TYPES = [
  'MAINTENANCE_REQUEST',
  'MACHINE',
  'PRODUCTION_ORDER',
  'PRODUCTION_NONCONFORMANCE',
  'SPARE_PART',
] as const;

export class CreateShiftHandoverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty()
  @IsDateString()
  handoverDate: string;

  @ApiProperty()
  @IsString()
  outgoingShiftId: string;

  @ApiProperty()
  @IsString()
  incomingShiftId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outgoingPersonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incomingPersonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShiftHandoverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateShiftHandoverItemDto {
  @ApiProperty()
  @IsString()
  shiftHandoverId: string;

  @ApiProperty({ enum: HANDOVER_ITEM_CATEGORIES })
  @IsString()
  @IsIn(HANDOVER_ITEM_CATEGORIES as unknown as string[])
  category: string;

  @ApiProperty({ enum: HANDOVER_ITEM_ENTITY_TYPES })
  @IsString()
  @IsIn(HANDOVER_ITEM_ENTITY_TYPES as unknown as string[])
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitySummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
