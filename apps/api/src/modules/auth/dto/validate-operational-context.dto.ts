import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ValidateOperationalContextDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsOptional()
  @IsString()
  administrationId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;
}
