import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Target of the first-branch bootstrap.
 *
 * This DTO exists only for the SUPER_ADMIN first-branch bootstrap route. The
 * normal POST /branches path keeps deriving company ownership from the active
 * operational context and never trusts a client-supplied companyId.
 */
export class BootstrapFirstBranchDto {
  @ApiProperty({
    description:
      'Explicit target company that currently has zero branches. Unlike the normal branch creation path this value is honoured because the caller is an authenticated SUPER_ADMIN and the company cannot have an active operational context yet.',
  })
  @IsString()
  companyId: string;

  @ApiPropertyOptional({
    description: 'Optional branch code. When omitted the canonical BRANCH numbering sequence is consumed.',
  })
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
