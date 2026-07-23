import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MachineSparePartsController } from './machine-spare-parts.controller';
import { MachineSparePartsService } from './machine-spare-parts.service';

@Module({
  imports: [AuditModule],
  controllers: [MachineSparePartsController],
  providers: [MachineSparePartsService],
  exports: [MachineSparePartsService],
})
export class MachineSparePartsModule {}
