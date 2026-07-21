import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: 'WH-MAIN' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Main Warehouse' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}
