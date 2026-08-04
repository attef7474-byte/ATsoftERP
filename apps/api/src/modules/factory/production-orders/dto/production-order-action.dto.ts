import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class ProductionOrderActionDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(0) lockVersion!: number;
}

export class ProductionOrderReasonActionDto extends ProductionOrderActionDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
