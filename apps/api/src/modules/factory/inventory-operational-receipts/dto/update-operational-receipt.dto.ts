import { PartialType } from '@nestjs/swagger';
import { CreateOperationalReceiptDto } from './create-operational-receipt.dto';

export class UpdateOperationalReceiptDto extends PartialType(CreateOperationalReceiptDto) {}
