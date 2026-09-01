import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnterCountLineDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedQty: number;

  // VAL-R1D: authoritative cost source for a count SURPLUS (counted > system)
  // on an ACTIVE valuation warehouse (requires the valuation cost-input
  // permission; currency must equal the ACTIVE policy currency). Ignored for a
  // shortage, which revalues at the current moving average.
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valuationReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
