import { IsOptional, IsString, IsIn, IsInt, IsISO8601, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class HistoryQueryDto {
  @IsOptional() @IsString() personId?: string;
  @IsOptional() @IsString() assignmentId?: string;
  @IsOptional() @IsString() supervisorAssignmentId?: string;
  @IsOptional() @IsString() @IsIn(['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER']) leadershipLevel?: string;
  @IsOptional() @IsString() @IsIn(['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING']) assignmentType?: string;
  @IsOptional() @IsString() @IsIn(['DIRECT', 'MATRIX', 'FUNCTIONAL']) relationshipType?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() administrationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() @IsIn(['PAST', 'CURRENT', 'FUTURE']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 25;
  @IsOptional() @IsString() @IsIn(['effectiveFrom_asc', 'effectiveFrom_desc']) sort?: string = 'effectiveFrom_desc';
}
