import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateProductionLineDto {
  @ApiPropertyOptional({ description: 'Auto-generated if omitted' })
  @IsString() @IsOptional()
  code?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  location?: string;

  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty()
  @IsString()
  branchId: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  administrationId?: string;

  @ApiProperty()
  @IsString()
  departmentId: string;

  @ApiProperty()
  @IsString()
  operationTypeId: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  costCenterId?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
