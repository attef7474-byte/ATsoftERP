import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveBarcodeDto {
  @ApiProperty()
  @IsString()
  value: string;
}
