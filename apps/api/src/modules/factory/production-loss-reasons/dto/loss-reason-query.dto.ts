import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { LOSS_REASON_CATEGORIES, LOSS_REASON_STATUSES } from '../production-loss-reasons.constants';

export class LossReasonQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(LOSS_REASON_STATUSES) status?: string;
  @IsOptional() @IsIn(LOSS_REASON_CATEGORIES) lossCategory?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsISO8601() effectiveDate?: string;
}
