import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateProductionRunDto {
  @IsUUID() clientRequestId!: string;
  @IsString() productionOrderId!: string;
  @IsOptional() @IsString() operationalAssignmentId?: string;
  @IsOptional() @IsString() shiftAssignmentId?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) assignmentReason?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}