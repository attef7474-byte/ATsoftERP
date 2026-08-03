import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductionUnitDto {
  @ApiProperty({ description: 'Unit code (unique per company+branch)' })
  @IsString() @IsNotEmpty() code: string;

  @ApiProperty() @IsString() @IsNotEmpty() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() abbreviation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(6) decimals?: number;
}
