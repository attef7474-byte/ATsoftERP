import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Canonical person registration DTOs.
 *
 * The payload is the answer to "what does a person need entered once, on the day they
 * start?", grouped by the specialized model each fact belongs to. Every tenant-scoped
 * field is either omitted (and derived from the active operational context) or validated
 * against it server side; company/branch are deliberately NOT accepted from the client,
 * because the active context is the only authority for tenancy.
 */
export class PersonPlacementDto {
  @ApiPropertyOptional({ description: 'Branch for the placement. Must belong to the active company. Defaults to the active branch.' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Administration owning the department. Must belong to the active company.' })
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiProperty({ description: 'Department of the initial placement. Must belong to the active company.' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Job title. Must belong to the active company.' })
  @IsOptional()
  @IsString()
  jobTitleId?: string;

  @ApiPropertyOptional({
    example: 'PRIMARY',
    enum: ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'],
    description: 'Only one active PRIMARY placement is allowed per person.',
  })
  @IsOptional()
  @IsIn(['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'])
  assignmentType?: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Defaults to now.',
  })
  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PersonLoginDto {
  @ApiPropertyOptional({
    description:
      'Link an EXISTING user instead of creating one. The user must be in the active company and branch, not deleted, and not already linked to another person.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Required when creating a new login (omit when linking userId).' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Plain password. The password policy is the single authority and is applied by the credential service, not duplicated here.',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Roles granted to the new login. Requires the role-assignment permission in addition to user:create.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

export class PersonMaintenanceCapabilityDto {
  @ApiProperty({ example: 'TECHNICIAN' })
  @IsString()
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ example: 480, default: 480 })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyCapacityMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePersonRegistrationDto {
  @ApiPropertyOptional({
    description: 'Person code. Unique. Auto-generated from the personnel numbering sequence when omitted.',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'MAINTENANCE', enum: ['OPERATIONAL', 'MAINTENANCE'] })
  @IsOptional()
  @IsIn(['OPERATIONAL', 'MAINTENANCE'])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: PersonPlacementDto,
    description:
      'Required. The placement is what anchors the person to a company/branch, because an OperationalPerson carries no tenant columns of its own.',
  })
  @ValidateNested()
  @Type(() => PersonPlacementDto)
  placement: PersonPlacementDto;

  @ApiPropertyOptional({ type: PersonLoginDto, description: 'Optional system login for this person.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonLoginDto)
  login?: PersonLoginDto;

  @ApiPropertyOptional({
    type: PersonMaintenanceCapabilityDto,
    description: 'Optional maintenance capability extension for this person.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonMaintenanceCapabilityDto)
  maintenance?: PersonMaintenanceCapabilityDto;
}