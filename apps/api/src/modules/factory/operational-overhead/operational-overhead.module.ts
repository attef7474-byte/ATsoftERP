import { Module } from '@nestjs/common';
import { OperationalOverheadController } from './operational-overhead.controller';
import { OperationalOverheadService } from './operational-overhead.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OperationalOverheadController],
  providers: [OperationalOverheadService],
  exports: [OperationalOverheadService],
})
export class OperationalOverheadModule {}
