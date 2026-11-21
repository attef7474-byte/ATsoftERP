import { FullPersonName, YemenPhone } from '../../../../../common/validation/person-identity';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenancePersonnelDto {
  @ApiProperty() @IsString() departmentId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiProperty() @IsString() @FullPersonName() name: string;
  @ApiProperty() @IsString() role: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specialty?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @YemenPhone() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() userId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateMaintenancePersonnelDto {
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @FullPersonName() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specialty?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @YemenPhone() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() userId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
