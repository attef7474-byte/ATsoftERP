import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBusinessPartnerDto {
  @ApiProperty({ example: 'BP-000001' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: 'CUSTOMER' })
  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'SUPPLIER', 'BOTH'])
  type?: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commercialName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTermId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commercialRegistrationNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatRegistrationNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalIdOrRegistryNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowCredit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSupplier?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
