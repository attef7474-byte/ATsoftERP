import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { CreateMaintenanceTaskDto } from './create-maintenance-task.dto';

export class ExecutionStartDto {
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true })
  participantUserIds?: string[];
  @IsOptional() @IsBoolean()
  machineStopped?: boolean;
}
export class ExecutionJoinDto {
  @IsOptional() @IsString() @IsNotEmpty()
  technicianUserId?: string;
}
export class ExecutionLeaveDto {
  @IsOptional() @IsString() @MaxLength(10000)
  workPerformed?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  remainingWork?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  notes?: string;
  @IsOptional() @IsIn(['LEAVE', 'PAUSE'])
  endReason?: 'LEAVE' | 'PAUSE';
}
export class ExecutionHandoffDto {
  @IsString() @IsNotEmpty() @MaxLength(10000)
  workPerformed: string;
  @IsString() @IsNotEmpty() @MaxLength(10000)
  remainingWork: string;
  @IsOptional() @IsString() @IsNotEmpty()
  handoffToUserId?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  notes?: string;
}
export class ExecutionPartInputDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  clientRequestId: string;
  @IsOptional() @IsString() @IsNotEmpty()
  sparePartId?: string;
  @IsOptional() @IsString() @IsNotEmpty()
  productId?: string;
  @IsString() @IsNotEmpty()
  warehouseId: string;
  @IsOptional() @IsString() @IsNotEmpty()
  warehouseLocationId?: string;
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 }) @Min(0.0001)
  quantity: number;
  @IsIn(['CONSUMED', 'INSTALLED', 'REPLACED'])
  usageType: 'CONSUMED' | 'INSTALLED' | 'REPLACED';
  @IsOptional() @IsString()
  executionSessionId?: string;
  @IsOptional() @IsString()
  requiredPartId?: string;
  @IsOptional() @IsString()
  workOrderPartId?: string;
  @IsOptional() @IsIn(['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'])
  issuedStockCondition?: 'NEW' | 'USED_SERVICEABLE' | 'USED_REPAIRABLE' | 'DAMAGED_REPAIRABLE' | 'DAMAGED_NOT_REPAIRABLE';
  @IsOptional() @IsString()
  replacementAction?: string;
  @IsOptional() @IsString()
  oldInstalledPartId?: string;
  @IsOptional() @IsString()
  removedPartCondition?: string;
  @IsOptional() @IsString()
  removedPartWarehouseId?: string;
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 }) @Min(0.0001)
  removedPartQuantity?: number;
  @IsOptional() @IsString() @MaxLength(10000)
  noReturnReason?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
export class ExecutionCompleteDto {
  @IsOptional() @IsString() @MaxLength(10000)
  workPerformed?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
  @IsOptional() @IsBoolean()
  machineReturnedToService?: boolean;
  @IsOptional() @IsBoolean()
  confirmEndParticipants?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExecutionPartInputDto)
  parts?: ExecutionPartInputDto[];
}
export class RegisterHistoricalExecutionDto extends CreateMaintenanceTaskDto {
  @IsDateString()
  startedAt: string;
  @IsDateString()
  completedAt: string;
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true })
  participantUserIds: string[];
  @IsString() @IsNotEmpty() @MaxLength(10000)
  workPerformed: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExecutionPartInputDto)
  parts?: ExecutionPartInputDto[];
  @IsOptional() @IsBoolean()
  machineReturnedToService?: boolean;
  @IsOptional() @IsDateString()
  downtimeStartedAt?: string;
}
