import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReverseInventoryMovementDto {
  @ApiPropertyOptional({ description: 'Idempotency token scoped to the active company and branch. Reusing the same requestId returns the same compensating movement.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @ApiPropertyOptional({ description: 'Movement date for the compensating movement (defaults to now)' })
  @IsOptional()
  @IsDateString()
  movementDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
