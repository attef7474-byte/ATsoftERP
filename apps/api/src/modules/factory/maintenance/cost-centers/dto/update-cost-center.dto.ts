import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCostCenterDto } from './create-cost-center.dto';

export class UpdateCostCenterDto extends PartialType(CreateCostCenterDto) {
  @ApiPropertyOptional({ description: 'Required when changing parentId or effective overlay (scope override).' })
  @IsOptional()
  @IsString()
  reason?: string;
}
