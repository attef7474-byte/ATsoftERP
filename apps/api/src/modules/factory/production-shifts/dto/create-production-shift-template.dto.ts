import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsBoolean, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateDayDto {
  @ApiProperty({ description: '0=Sunday ... 6=Saturday' })
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;

  @ApiProperty() @IsString() @IsNotEmpty() shiftId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() isWorkDay?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CreateProductionShiftTemplateDto {
  @ApiPropertyOptional({ description: 'Template code (auto-generated when omitted)' })
  @IsOptional() @IsString() code?: string;

  @ApiProperty() @IsString() @IsNotEmpty() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ description: 'One entry per day of week' })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => TemplateDayDto)
  days: TemplateDayDto[];
}

export class UpdateProductionShiftTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TemplateDayDto) days?: TemplateDayDto[];
}
