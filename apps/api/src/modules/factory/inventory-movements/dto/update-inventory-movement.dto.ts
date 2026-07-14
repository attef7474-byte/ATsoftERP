import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInventoryMovementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
