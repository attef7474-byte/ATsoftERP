import { IsString, IsBoolean, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateNotificationRuleDto {
  @ApiProperty()
  @IsString()
  code: string

  @ApiProperty()
  @IsString()
  nameAr: string

  @ApiProperty()
  @IsString()
  nameEn: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty()
  @IsString()
  eventType: string

  @ApiPropertyOptional({ default: 'IN_APP' })
  @IsOptional()
  @IsString()
  channel?: string

  @ApiPropertyOptional({ default: 'INFO' })
  @IsOptional()
  @IsString()
  severity?: string

  @ApiPropertyOptional({ default: true })
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
