import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsISO8601, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PreviewPlanningScheduleDto {
  @IsOptional() @IsString() @MaxLength(64) calendarId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) orderIds?: string[];

  @IsOptional() @IsISO8601() horizonFrom?: string;

  @IsOptional() @IsISO8601() horizonTo?: string;

  @IsOptional() @IsString() @MaxLength(120) productionLineId?: string;
}

export class ApplyPlanningScheduleDto {
  @IsOptional() @IsString() @MaxLength(64) calendarId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) orderIds?: string[];

  @IsOptional() @IsISO8601() horizonFrom?: string;

  @IsOptional() @IsISO8601() horizonTo?: string;

  @IsOptional() @IsString() @MaxLength(120) productionLineId?: string;

  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) plans!: ApplyPlanningItemDto[];
}

export class ApplyPlanningItemDto {
  @IsString() @MaxLength(64) orderId!: string;

  @IsInt() @Min(0) lockVersion!: number;

  @IsISO8601() scheduledStartAt!: string;

  @IsISO8601() scheduledEndAt!: string;
}
