import { IsString, IsOptional, IsIn, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EmployeeCategory {
  OPERATIONAL = 'OPERATIONAL',
  MAINTENANCE = 'MAINTENANCE',
}

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Employee identity code (unique).' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'MAINTENANCE', enum: EmployeeCategory })
  @IsOptional()
  @IsEnum(EmployeeCategory)
  category?: EmployeeCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Department for the initial placement (OperationalPersonAssignment) in the active company/branch.' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({ example: 'PRIMARY', enum: ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'] })
  @IsOptional()
  @IsIn(['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'])
  assignmentType?: string;
}
