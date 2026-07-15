import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBusinessPartnerGroupDto {
  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Retail Customers' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
