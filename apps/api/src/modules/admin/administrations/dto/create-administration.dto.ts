import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdministrationDto {
  @ApiPropertyOptional({
    description: 'Deprecated: branch ownership is derived from the active operational context and never trusted from the client.',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

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
