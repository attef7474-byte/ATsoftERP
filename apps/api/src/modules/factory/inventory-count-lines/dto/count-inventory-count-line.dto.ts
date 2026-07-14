import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CountInventoryCountLineDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedQty: number;
}
