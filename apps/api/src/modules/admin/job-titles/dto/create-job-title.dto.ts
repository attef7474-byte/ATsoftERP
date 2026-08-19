import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobTitleDto {
  @ApiPropertyOptional({
    description: 'Deprecated: company ownership is derived from the active operational context and never trusted from the client.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ example: 'ENG01' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Maintenance Engineer' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'مهندس صيانة' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Maintenance Engineer' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: 'OPERATIONAL', enum: ['OPERATIONAL', 'MANAGEMENT', 'TECHNICAL', 'SUPPORT'] })
  @IsOptional()
  @IsString()
  @IsIn(['OPERATIONAL', 'MANAGEMENT', 'TECHNICAL', 'SUPPORT'])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
