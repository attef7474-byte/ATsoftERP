import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PrintBarcodeLabelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  printerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  copies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
