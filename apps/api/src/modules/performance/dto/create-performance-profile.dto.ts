import { IsString, IsOptional, IsBoolean, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PERFORMANCE_PROFILE_CATEGORIES = [
  'MAINTENANCE',
  'PRODUCTION',
  'WAREHOUSE',
  'QUALITY',
  'PLANNING',
  'SUPERVISION',
  'GENERAL',
] as const;

export class CreatePerformanceProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: PERFORMANCE_PROFILE_CATEGORIES })
  @IsOptional()
  @IsIn([...PERFORMANCE_PROFILE_CATEGORIES])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
