import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { NCR_STATUSES } from '../production-quality.constants';

export class CreateNcrDto {
  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;

  @IsOptional()
  @IsString()
  dispositionId?: string;

  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  @IsOptional()
  severity?: string = 'MAJOR';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  detectionDate?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class NcrQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class NcrTransitionDto {
  @IsIn(NCR_STATUSES)
  @IsNotEmpty()
  toStatus!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action!: string;

  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class NcrAttachDto {
  @IsString()
  @IsNotEmpty()
  attachmentId!: string;
}
