import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class CostInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() lineId!: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitCost!: number;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(10) currencyCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
