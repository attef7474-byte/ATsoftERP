import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentTermDto {
  @ApiProperty({ example: 'NET30' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Net 30 Days' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  days: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  discountDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountPercent?: number;
}
