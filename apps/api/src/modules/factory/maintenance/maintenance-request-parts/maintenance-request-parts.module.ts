import { Module } from '@nestjs/common';
import { MaintenanceRequestPartsController } from './maintenance-request-parts.controller';
import { MaintenanceRequestPartsService } from './maintenance-request-parts.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceRequestPartsController],
  providers: [MaintenanceRequestPartsService],
  exports: [MaintenanceRequestPartsService],
})
export class MaintenanceRequestPartsModule {}
