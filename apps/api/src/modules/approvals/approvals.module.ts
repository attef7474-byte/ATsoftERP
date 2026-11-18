import { IssueVouchersController } from './issue-vouchers.controller';
import { IssueVoucherLookupsService } from './issue-voucher-lookups.service';
import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  controllers: [ApprovalsController, IssueVouchersController],
  providers: [ApprovalsService, IssueVoucherLookupsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
