import { IsIn } from 'class-validator';
import { LOSS_REASON_STATUSES } from '../production-loss-reasons.constants';

export class LossReasonStatusDto {
  @IsIn(LOSS_REASON_STATUSES) status!: string;
}
