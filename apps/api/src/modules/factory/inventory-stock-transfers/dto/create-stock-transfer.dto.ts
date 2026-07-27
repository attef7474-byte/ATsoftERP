import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockTransferLineDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateStockTransferDto {
  @ApiProperty() @IsString() companyId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiProperty() @IsString() sourceWarehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceLocationId?: string;
  @ApiProperty() @IsString() destinationWarehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() destinationLocationId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [CreateStockTransferLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateStockTransferLineDto)
  lines: CreateStockTransferLineDto[];
}
