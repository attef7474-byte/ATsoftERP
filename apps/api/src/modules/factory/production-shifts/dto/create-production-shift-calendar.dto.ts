import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsInt, Min, Max, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalendarEntryDto {
  @ApiProperty() @IsDateString() date: string;

  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() isWorkDay?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateProductionShiftCalendarDto {
  @ApiPropertyOptional({ description: 'Calendar code (auto-generated when omitted)' })
  @IsOptional() @IsString() code?: string;

  @ApiProperty() @IsString() @IsNotEmpty() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ description: 'Base weekly template' })
  @IsOptional() @IsString() templateId?: string;

  @ApiProperty() @IsDateString() effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CalendarEntryDto) entries?: CalendarEntryDto[];
}

export class UpdateProductionShiftCalendarDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
}

export class AddCalendarEntryDto {
  @ApiProperty() @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isWorkDay?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateCalendarEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isWorkDay?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ProductionShiftCalendarQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveOn?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}
