import { IsString, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComponentSparePartDto {
  @ApiProperty() @IsString() componentId: string;
  @ApiProperty() @IsString() sparePartId: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageNote?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class UpdateComponentSparePartDto {
  @ApiPropertyOptional() @IsString() @IsOptional() componentId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sparePartId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0.001) quantity?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageNote?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
