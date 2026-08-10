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
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  reasonId?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
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
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  @IsNotEmpty()
  maintenanceRequestId!: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
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
