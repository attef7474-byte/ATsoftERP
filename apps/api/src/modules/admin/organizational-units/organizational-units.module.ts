import { Module } from '@nestjs/common';
import { OrganizationalUnitsController } from './organizational-units.controller';
import { OrganizationalUnitsService } from './organizational-units.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OrganizationalUnitsController],
  providers: [OrganizationalUnitsService],
  exports: [OrganizationalUnitsService],
})
export class OrganizationalUnitsModule {}
