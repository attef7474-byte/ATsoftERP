import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseLocationDto {
  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ example: 'A-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Row A, Shelf 01' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
