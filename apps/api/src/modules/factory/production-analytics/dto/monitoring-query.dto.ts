import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class MonitoringQueryDto {
  @IsOptional()
  @IsString()
  productionLineId?: string;
  @IsOptional()
  @IsString()
  machineId?: string;
  @IsOptional()
  @IsString()
  operationTypeId?: string;
  @IsOptional()
  @IsIn(['MANUFACTURING', 'PACKAGING', 'UNCLASSIFIED'])
  classification?: string;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
