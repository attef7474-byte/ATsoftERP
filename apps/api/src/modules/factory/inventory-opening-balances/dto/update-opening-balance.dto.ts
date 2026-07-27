import { PartialType } from '@nestjs/swagger';
import { CreateOpeningBalanceDto } from './create-opening-balance.dto';

export class UpdateOpeningBalanceDto extends PartialType(CreateOpeningBalanceDto) {}
