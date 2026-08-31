import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class InitializeProductDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) unitCost!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
