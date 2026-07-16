import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceRequestCostDto {
  @ApiProperty()
  @IsString()
  requestId: string;

  @ApiProperty({ enum: ['LABOR', 'MATERIAL', 'SERVICE', 'OTHER'] })
  @IsString()
  @IsIn(['LABOR', 'MATERIAL', 'SERVICE', 'OTHER'])
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incurredAt?: string;
}
