import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  LOSS_REASON_CATEGORIES,
  LOSS_REASON_MAINTENANCE_POLICIES,
  LOSS_REASON_SEVERITIES,
  LOSS_REASON_STATUSES,
} from '../production-loss-reasons.constants';

export class CreateLossReasonDto {
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsString() @MinLength(1) @MaxLength(200) nameAr!: string;
  @IsString() @MinLength(1) @MaxLength(200) nameEn!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsIn(LOSS_REASON_CATEGORIES) lossCategory!: string;
  @IsOptional() @IsBoolean() plannedDefault?: boolean;
  @IsOptional() @IsIn(LOSS_REASON_SEVERITIES) severityDefault?: string;
  @IsOptional() @IsIn(LOSS_REASON_MAINTENANCE_POLICIES) maintenanceRequestPolicy?: string;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsIn(LOSS_REASON_STATUSES) status?: string;
}
