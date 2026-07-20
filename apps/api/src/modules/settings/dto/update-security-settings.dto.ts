import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  passwordMinLength?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireNumber?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireSymbol?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sessionTimeoutMinutes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxLoginAttempts?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lockoutMinutes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  twoFactorEnabledDefault?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auditSensitiveActions?: boolean
}
