import { Module } from '@nestjs/common';
import { SparePartConditionController } from './spare-part-conditions.controller';
import { SparePartConditionService } from './spare-part-conditions.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SparePartConditionController],
  providers: [SparePartConditionService],
  exports: [SparePartConditionService],
})
export class SparePartConditionModule {}
