import { Module } from '@nestjs/common';
import { AuditModule as NewAuditModule } from '../../modules/audit/audit.module';

@Module({
  imports: [NewAuditModule],
  exports: [NewAuditModule],
})
export class AuditModule {}
