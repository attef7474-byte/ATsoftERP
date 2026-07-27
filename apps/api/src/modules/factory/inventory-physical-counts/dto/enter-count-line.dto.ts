import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnterCountLineDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedQty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
