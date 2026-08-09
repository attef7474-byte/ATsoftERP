import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export const APPEARANCE_THEME_MODES = ['light', 'dark'] as const
export const APPEARANCE_GRADIENT_FOCUS = ['SOFT', 'BALANCED', 'CONCENTRATED'] as const
export const APPEARANCE_GRADIENT_DIRECTIONS = [
  'BILATERAL_CENTER',
  'RIGHT_TO_LEFT',
  'LEFT_TO_RIGHT',
  'TOP_TO_BOTTOM',
  'BOTTOM_TO_TOP',
] as const
export const APPEARANCE_PRESETS = [
  'REFERENCE_DEFAULT',
  'MUTED',
  'MEDIUM',
  'CONCENTRATED',
  'GLASS',
  'CALM',
  'FLAT',
] as const
export const APPEARANCE_FONT_SCALES = ['small', 'medium', 'large'] as const
export const APPEARANCE_SHADOW_DEPTHS = ['light', 'medium', 'strong'] as const
export const APPEARANCE_RADII = ['small', 'medium', 'large'] as const
export const APPEARANCE_SIDEBAR_BGS = ['navy', 'slate', 'teal', 'custom'] as const
export const APPEARANCE_SIDEBAR_ACCENTS = ['teal', 'blue', 'emerald', 'violet'] as const
export const APPEARANCE_SIDEBAR_DENSITIES = ['default', 'compact', 'comfortable'] as const
export const APPEARANCE_SIDEBAR_FONTS = ['normal', 'large'] as const
export const APPEARANCE_TABLE_DENSITIES = ['default', 'compact', 'comfortable'] as const

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const OPTIONAL_COLOR = 'Color must be a 6-digit hex value such as #2563eb.'

export class UpdateAppearanceSettingsDto {
  @ApiPropertyOptional({ enum: APPEARANCE_THEME_MODES })
  @IsOptional()
  @IsIn(APPEARANCE_THEME_MODES)
  themeMode?: string

  @ApiPropertyOptional({ example: '#2563eb', description: OPTIONAL_COLOR })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'primaryColor ' + OPTIONAL_COLOR })
  primaryColor?: string

  @ApiPropertyOptional({ example: '#14b8a6', description: OPTIONAL_COLOR })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'accentColor ' + OPTIONAL_COLOR })
  accentColor?: string

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  colorIntensity?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gradientEnabled?: boolean

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  gradientStrength?: number

  @ApiPropertyOptional({ enum: APPEARANCE_GRADIENT_FOCUS })
  @IsOptional()
  @IsIn(APPEARANCE_GRADIENT_FOCUS)
  gradientFocus?: string

  @ApiPropertyOptional({ enum: APPEARANCE_GRADIENT_DIRECTIONS })
  @IsOptional()
  @IsIn(APPEARANCE_GRADIENT_DIRECTIONS)
  gradientDirection?: string

  @ApiPropertyOptional({ enum: APPEARANCE_PRESETS })
  @IsOptional()
  @IsIn(APPEARANCE_PRESETS)
  preset?: string

  @ApiPropertyOptional({ enum: APPEARANCE_FONT_SCALES })
  @IsOptional()
  @IsIn(APPEARANCE_FONT_SCALES)
  fontScale?: string

  @ApiPropertyOptional({ enum: APPEARANCE_SHADOW_DEPTHS })
  @IsOptional()
  @IsIn(APPEARANCE_SHADOW_DEPTHS)
  shadowDepth?: string

  @ApiPropertyOptional({ enum: APPEARANCE_RADII })
  @IsOptional()
  @IsIn(APPEARANCE_RADII)
  radius?: string

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  glassOpacity?: number

  @ApiPropertyOptional({ minimum: 0, maximum: 48 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(48)
  glassBlur?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compactMode?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean

  @ApiPropertyOptional({ enum: APPEARANCE_SIDEBAR_BGS })
  @IsOptional()
  @IsIn(APPEARANCE_SIDEBAR_BGS)
  sidebarBg?: string

  @ApiPropertyOptional({ enum: APPEARANCE_SIDEBAR_ACCENTS })
  @IsOptional()
  @IsIn(APPEARANCE_SIDEBAR_ACCENTS)
  sidebarAccent?: string

  @ApiPropertyOptional({ enum: APPEARANCE_SIDEBAR_DENSITIES })
  @IsOptional()
  @IsIn(APPEARANCE_SIDEBAR_DENSITIES)
  sidebarDensity?: string

  @ApiPropertyOptional({ enum: APPEARANCE_SIDEBAR_FONTS })
  @IsOptional()
  @IsIn(APPEARANCE_SIDEBAR_FONTS)
  sidebarFont?: string

  @ApiPropertyOptional({ enum: APPEARANCE_TABLE_DENSITIES })
  @IsOptional()
  @IsIn(APPEARANCE_TABLE_DENSITIES)
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
