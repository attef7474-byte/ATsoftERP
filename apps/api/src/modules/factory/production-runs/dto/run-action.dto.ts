import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class RunActionDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(0) lockVersion!: number;
}

export class RunReasonActionDto extends RunActionDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class RunPauseActionDto extends RunActionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}