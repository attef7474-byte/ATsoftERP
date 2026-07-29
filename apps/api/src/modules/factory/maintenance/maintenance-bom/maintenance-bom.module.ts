import { Module } from '@nestjs/common';
import { MaintenanceBomController } from './maintenance-bom.controller';
import { MaintenanceBomService } from './maintenance-bom.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceBomController],
  providers: [MaintenanceBomService],
  exports: [MaintenanceBomService],
})
export class MaintenanceBomModule {}
