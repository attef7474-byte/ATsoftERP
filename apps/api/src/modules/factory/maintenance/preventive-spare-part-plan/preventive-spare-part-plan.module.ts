import { Module } from '@nestjs/common';
import { PreventiveSparePartPlanController } from './preventive-spare-part-plan.controller';
import { PreventiveSparePartPlanService } from './preventive-spare-part-plan.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PreventiveSparePartPlanController],
  providers: [PreventiveSparePartPlanService],
  exports: [PreventiveSparePartPlanService],
})
export class PreventiveSparePartPlanModule {}
