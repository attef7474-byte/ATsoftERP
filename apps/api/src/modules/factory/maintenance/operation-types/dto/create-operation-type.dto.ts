import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOperationTypeDto {
  @ApiPropertyOptional({ example: 'MANUFACTURING' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Manufacturing' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
