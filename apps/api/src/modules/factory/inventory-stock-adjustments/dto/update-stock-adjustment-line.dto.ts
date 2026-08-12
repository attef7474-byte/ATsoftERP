import { PartialType } from '@nestjs/swagger';
import { CreateStockAdjustmentLineDto } from './create-stock-adjustment.dto';

export class UpdateStockAdjustmentLineDto extends PartialType(CreateStockAdjustmentLineDto) {}
