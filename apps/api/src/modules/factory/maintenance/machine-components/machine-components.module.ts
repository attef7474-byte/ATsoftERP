import { Module } from '@nestjs/common';
import { MachineComponentsController } from './machine-components.controller';
import { MachineComponentsService } from './machine-components.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MachineComponentsController],
  providers: [MachineComponentsService],
  exports: [MachineComponentsService],
})
export class MachineComponentsModule {}
