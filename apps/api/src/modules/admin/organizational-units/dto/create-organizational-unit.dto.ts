import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ORGANIZATIONAL_UNIT_TYPES = [
  'DEPARTMENT',
  'SECTION',
  'UNIT',
  'TEAM',
  'PROJECT',
  'OTHER',
] as const;

export class CreateOrganizationalUnitDto {
  @ApiPropertyOptional({ example: 'PROD' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Production Department' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ORGANIZATIONAL_UNIT_TYPES, default: 'DEPARTMENT' })
  @IsOptional()
  @IsIn(ORGANIZATIONAL_UNIT_TYPES)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
