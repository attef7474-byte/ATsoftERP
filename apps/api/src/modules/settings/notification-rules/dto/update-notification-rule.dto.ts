import { IsString, IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateNotificationRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameEn?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRoleId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetPermission?: string
}
