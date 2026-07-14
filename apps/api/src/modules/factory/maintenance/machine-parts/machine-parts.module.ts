import { Module } from '@nestjs/common';
import { MachinePartsController } from './machine-parts.controller';
import { MachinePartsService } from './machine-parts.service';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MachinePartsController],
  providers: [MachinePartsService],
  exports: [MachinePartsService],
})
export class MachinePartsModule {}
