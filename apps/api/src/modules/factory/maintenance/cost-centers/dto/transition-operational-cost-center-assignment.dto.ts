import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const ASSIGNMENT_TRANSITION_TARGETS = ['ACTIVE', 'ENDED'] as const;

export class TransitionOperationalCostCenterAssignmentDto {
  @ApiProperty({ enum: ASSIGNMENT_TRANSITION_TARGETS, example: 'ACTIVE' })
  @IsString()
  @IsIn(ASSIGNMENT_TRANSITION_TARGETS)
  toStatus: string;

  @ApiProperty({ description: 'Required for every transition (DRAFT->ACTIVE or ACTIVE->ENDED).' })
  @IsString()
  reason: string;
}
