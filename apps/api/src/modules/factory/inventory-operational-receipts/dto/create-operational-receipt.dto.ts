import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min, ArrayMinSize, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OPERATIONAL_RECEIPT_TYPES, RECEIPT_SOURCES } from '../receipt-type.domain';

export class CreateOperationalReceiptLineDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateOperationalReceiptDto {
  @ApiPropertyOptional() @IsOptional() @IsString() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiProperty() @IsString() warehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierDoc?: string;
  @ApiPropertyOptional({ enum: OPERATIONAL_RECEIPT_TYPES })
  @IsOptional()
  @IsIn(OPERATIONAL_RECEIPT_TYPES)
  receiptType?: string;
  @ApiPropertyOptional({ enum: RECEIPT_SOURCES })
  @IsOptional()
  @IsIn(RECEIPT_SOURCES)
  receiptSource?: string;
  @ApiProperty({ type: [CreateOperationalReceiptLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOperationalReceiptLineDto)
  lines: CreateOperationalReceiptLineDto[];
}
