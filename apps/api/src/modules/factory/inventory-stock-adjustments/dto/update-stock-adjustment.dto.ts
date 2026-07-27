import { PartialType } from '@nestjs/swagger';
import { CreateStockAdjustmentDto } from './create-stock-adjustment.dto';

export class UpdateStockAdjustmentDto extends PartialType(CreateStockAdjustmentDto) {}
