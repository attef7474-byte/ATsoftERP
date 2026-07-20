import { IsString, IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateLanguageSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLocale?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fallbackLocale?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rtlEnabled?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFormat?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeFormat?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numberFormat?: string
}
