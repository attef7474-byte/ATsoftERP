import { Module } from '@nestjs/common';
import { MaintenanceSparePartRequestLinesController } from './maintenance-spare-part-request-lines.controller';
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceSparePartRequestLinesController],
  providers: [MaintenanceSparePartRequestLinesService],
  exports: [MaintenanceSparePartRequestLinesService],
})
export class MaintenanceSparePartRequestLinesModule {}
