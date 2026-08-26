import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(64)
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
  @IsInt()
  @Min(5)
  @Max(1440)
  sessionTimeoutMinutes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  maxLoginAttempts?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
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
