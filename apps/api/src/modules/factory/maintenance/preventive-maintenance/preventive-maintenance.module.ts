import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { AuditModule } from '../../../../common/audit/audit.module';
import { PreventiveMaintenanceController } from './preventive-maintenance.controller';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PreventiveMaintenanceController],
  providers: [PreventiveMaintenanceService],
  exports: [PreventiveMaintenanceService],
})
export class PreventiveMaintenanceModule {}
