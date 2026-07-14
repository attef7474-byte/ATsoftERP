import { Module } from '@nestjs/common';
import { MaintenanceChecklistItemsController } from './maintenance-checklist-items.controller';
import { MaintenanceChecklistItemsService } from './maintenance-checklist-items.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceChecklistItemsController],
  providers: [MaintenanceChecklistItemsService],
  exports: [MaintenanceChecklistItemsService],
})
export class MaintenanceChecklistItemsModule {}
