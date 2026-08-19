import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiPropertyOptional({
    description: 'Deprecated: company ownership is derived from the active operational context and never trusted from the client.',
  })
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
  administrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Information Technology' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'OPERATIONAL', enum: ['OPERATIONAL', 'MANAGEMENT', 'AREA', 'PROCESS', 'SECTION', 'UNIT', 'WORKSHOP'] })
  @IsOptional()
  @IsString()
  @IsIn(['OPERATIONAL', 'MANAGEMENT', 'AREA', 'PROCESS', 'SECTION', 'UNIT', 'WORKSHOP'])
  classification?: string;
}
