import { Module } from '@nestjs/common';
import { PersonRegistrationsController } from './person-registrations.controller';
import { PersonRegistrationsService } from './person-registrations.service';
import { SecurityModule } from '../../settings/security/security.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [SecurityModule, AuditModule],
  controllers: [PersonRegistrationsController],
  providers: [PersonRegistrationsService],
  exports: [PersonRegistrationsService],
})
export class PersonRegistrationsModule {}