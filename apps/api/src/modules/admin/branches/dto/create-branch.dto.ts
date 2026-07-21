import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiPropertyOptional({ example: 'HQ' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Headquarters' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
