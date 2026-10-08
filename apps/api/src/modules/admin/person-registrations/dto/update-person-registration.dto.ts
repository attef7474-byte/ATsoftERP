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
import {
  PersonLoginDto,
  PersonMaintenanceCapabilityDto,
} from './create-person-registration.dto';

/**
 * Coordinated update of an already registered person.
 *
 * `placement` is intentionally NOT accepted here. Moving a person between departments,
 * branches, companies or leadership levels is a temporal change that must close the
 * current assignment and open a new one, and the assignment history is the audit trail of
 * where somebody was and when. Overwriting a placement in place would destroy exactly that
 * history, so placement changes stay on the existing transfer workflow.
 */
export class PersonLoginUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Replaces the role set ONLY when explicitly provided. Omitting it preserves the existing roles untouched.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    description: 'Activate or deactivate the login. Omitting it preserves the current account status.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdatePersonRegistrationDto {
  @ApiPropertyOptional({ description: 'Person code. Unique.' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

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

  @ApiPropertyOptional({ type: PersonLoginUpdateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonLoginUpdateDto)
  login?: PersonLoginUpdateDto;

  @ApiPropertyOptional({ type: PersonMaintenanceCapabilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonMaintenanceCapabilityDto)
  maintenance?: PersonMaintenanceCapabilityDto;
}