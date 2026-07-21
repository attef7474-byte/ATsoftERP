import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNumberSequenceDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  operationName: string;

  @ApiProperty()
  @IsString()
  modelName: string;

  @ApiProperty()
  @IsString()
  domain: string;

  @ApiProperty()
  @IsString()
  prefix: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suffix?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentNumber?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  increment?: number;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  padding?: number;

  @ApiPropertyOptional({ default: 'GLOBAL' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ default: 'NEVER' })
  @IsOptional()
  @IsString()
  resetPolicy?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}
