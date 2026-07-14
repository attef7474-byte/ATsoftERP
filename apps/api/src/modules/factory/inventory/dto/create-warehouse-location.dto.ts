import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseLocationDto {
  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 'A-01' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Aisle A, Rack 01' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;
}
