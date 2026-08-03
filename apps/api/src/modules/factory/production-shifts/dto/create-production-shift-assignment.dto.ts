import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductionShiftAssignmentDto {
  @ApiPropertyOptional({ description: 'Assignment code (auto-generated when omitted)' })
  @IsOptional() @IsString() code?: string;

  @ApiProperty() @IsString() @IsNotEmpty() shiftId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() calendarId?: string;

  @ApiProperty({ description: 'Operational person (employee/technician)' })
  @IsString() @IsNotEmpty() operationalPersonId: string;

  @ApiProperty() @IsDateString() effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isPrimary?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateProductionShiftAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() calendarId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ProductionShiftAssignmentQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() operationalPersonId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveOn?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}
