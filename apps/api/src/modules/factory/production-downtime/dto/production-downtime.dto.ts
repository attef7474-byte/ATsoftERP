import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DOWNTIME_OWNER_DOMAINS, DOWNTIME_SEVERITIES } from '../production-downtime.constants';

export class OpenDowntimeDto {
  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @IsOptional()
  @IsUUID()
  productionRunId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @IsOptional()
  @IsUUID()
  maintenanceRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  planned?: boolean;

  @IsOptional()
  @IsEnum(DOWNTIME_SEVERITIES)
  severity?: string;

  @IsOptional()
  @IsEnum(DOWNTIME_OWNER_DOMAINS)
  ownerDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CloseDowntimeDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

export class CorrectDowntimeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @IsOptional()
  @IsBoolean()
  planned?: boolean;

  @IsOptional()
  @IsEnum(DOWNTIME_SEVERITIES)
  severity?: string;

  @IsOptional()
  @IsEnum(DOWNTIME_OWNER_DOMAINS)
  ownerDomain?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelDowntimeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class LinkMaintenanceDto {
  @IsUUID()
  @IsNotEmpty()
  maintenanceRequestId!: string;

  @IsOptional()
  @IsUUID()
  maintenanceWorkOrderId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class DowntimeQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  productionRunId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  ownerDomain?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
