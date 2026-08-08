import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateOperationalCostCenterAssignmentDto } from './create-operational-cost-center-assignment.dto';

export class UpdateOperationalCostCenterAssignmentDto extends PartialType(CreateOperationalCostCenterAssignmentDto) {
  @ApiPropertyOptional({ description: 'Required for scope/priority overrides on an ACTIVE assignment. Status cannot be changed through this DTO.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
