import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductionShiftDto {
  @ApiPropertyOptional({ description: 'Shift code (auto-generated when omitted)' })
  @IsOptional() @IsString() code?: string;

  @ApiProperty() @IsString() @IsNotEmpty() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ description: 'HH:mm start time' })
  @IsString() @IsNotEmpty() startTime: string;

  @ApiProperty({ description: 'HH:mm end time' })
  @IsString() @IsNotEmpty() endTime: string;

  @ApiPropertyOptional({ default: 480 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1440) durationMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1440) breakMinutes?: number;
}
