import { IsString, IsOptional, IsBoolean, IsIn, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PERFORMANCE_MAPPING_TARGET_TYPES = ['JOB_TITLE', 'MAINTENANCE_ROLE', 'OPERATIONAL_CATEGORY'] as const;

export class CreatePerformanceProfileMappingDto {
  @ApiProperty()
  @IsString()
  performanceProfileId: string;

  @ApiProperty({ enum: PERFORMANCE_MAPPING_TARGET_TYPES })
  @IsIn([...PERFORMANCE_MAPPING_TARGET_TYPES])
  targetType: string;

  @ApiPropertyOptional({ description: 'Required when targetType=JOB_TITLE' })
  @IsOptional()
  @IsString()
  jobTitleId?: string;

  @ApiPropertyOptional({ description: 'Required when targetType=MAINTENANCE_ROLE or OPERATIONAL_CATEGORY' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetCode?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  priority?: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
