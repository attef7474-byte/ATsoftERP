import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX', 'EAN13'] as const;

export class UpdateBarcodeLabelDto {
  @ApiPropertyOptional({ enum: SYMBOLOGIES })
  @IsOptional()
  @IsString()
  @IsIn(SYMBOLOGIES)
  symbology?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelTemplateCode?: string;
}
