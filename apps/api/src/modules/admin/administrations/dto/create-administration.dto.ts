import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdministrationDto {
  @ApiProperty()
  @IsString()
  branchId: string;

  @ApiPropertyOptional({ example: 'ADM' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'General Administration' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
