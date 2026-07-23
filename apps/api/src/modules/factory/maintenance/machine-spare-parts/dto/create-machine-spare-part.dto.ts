import { IsString, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMachineSparePartDto {
  @ApiProperty() @IsString() machineId: string;
  @ApiProperty() @IsString() sparePartId: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageNote?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class UpdateMachineSparePartDto {
  @ApiPropertyOptional() @IsString() @IsOptional() machineId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sparePartId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0.001) quantity?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageNote?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
