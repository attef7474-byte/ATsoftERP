import { IsString, IsOptional, IsIn, IsArray, ValidateNested, IsNumber, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRequiredPartDto {
  @ApiProperty()
  @IsString()
  sparePartId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usageNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateMaintenanceRequestDto {
  @ApiProperty({ example: 'machine-id' })
  @IsString()
  machineId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiProperty({ example: 'CORRECTIVE' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'MEDIUM' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Legacy title; new requests derive their title on the server.' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  machineStopped?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreateRequiredPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequiredPartDto)
  requiredParts?: CreateRequiredPartDto[];
}
