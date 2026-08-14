import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiPropertyOptional({
    description: 'Deprecated: company ownership is derived from the active operational context and never trusted from the client.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

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
