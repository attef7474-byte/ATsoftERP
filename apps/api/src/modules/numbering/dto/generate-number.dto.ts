import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateNumberDto {
  @ApiProperty()
  @IsString()
  code: string;
}
