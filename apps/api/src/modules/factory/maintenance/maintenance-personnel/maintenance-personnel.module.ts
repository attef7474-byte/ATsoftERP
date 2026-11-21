import { AuditModule } from '../../../audit/audit.module';
import { PersonRegistrationsModule } from '../../../admin/person-registrations/person-registrations.module';
import { Module } from '@nestjs/common';
import { MaintenancePersonnelController } from './maintenance-personnel.controller';
import { MaintenancePersonnelService } from './maintenance-personnel.service';

@Module({
  imports: [PersonRegistrationsModule, AuditModule],
  controllers: [MaintenancePersonnelController],
  providers: [MaintenancePersonnelService],
  exports: [MaintenancePersonnelService],
})
export class MaintenancePersonnelModule {}
