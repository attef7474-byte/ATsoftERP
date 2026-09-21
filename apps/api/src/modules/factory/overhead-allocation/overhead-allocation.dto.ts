import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AllocationNotesDto {
  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}
export class CreateOverheadAllocationDto extends AllocationNotesDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  periodId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200)
  clientRequestId!: string;
}
export class AllocationActionDto {}
export class AllocationPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
export class AllocationQueryDto extends AllocationPageDto {
  @IsOptional() @IsIn(['DRAFT', 'FINAL'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}
