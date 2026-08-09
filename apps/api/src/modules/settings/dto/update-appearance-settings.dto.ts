import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateAppearanceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeMode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accentColor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compactMode?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sidebarDensity?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  primaryColor?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  gradientStrength?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  gradientFocus?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  gradientDirection?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  preset?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  fontScale?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  shadow?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  radius?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  glassOpacity?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  glassBlur?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableDensity?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showStatusBar?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showActionBar?: boolean
}
