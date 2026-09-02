import { Transform } from 'class-transformer'
import { IsISO4217CurrencyCode, IsString, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateCompanyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyNameAr?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyNameEn?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commercialRegister?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLanguage?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string

  @ApiPropertyOptional({
    description: 'Company-scoped operational ledger currency. Null clears it before the first operational cost posting.',
    example: 'USD',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsISO4217CurrencyCode({ message: 'settings.company.invalidOperationalCurrency' })
  operationalCurrencyCode?: string | null
}
