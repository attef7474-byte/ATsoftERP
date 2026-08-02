import { IsString, IsIn, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkOrderStatusActionDto {
  @ApiProperty({
    enum: ['plan', 'start', 'complete', 'cancel'],
    description: 'plan: DRAFT->PLANNED | start: PLANNED->IN_PROGRESS | complete: IN_PROGRESS->COMPLETED | cancel: DRAFT/PLANNED->CANCELLED',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['plan', 'start', 'complete', 'cancel'])
  action: string;

  @ApiPropertyOptional({ description: 'Required when action is cancel.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
