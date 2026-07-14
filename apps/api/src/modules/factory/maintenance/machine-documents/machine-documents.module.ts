import { Module } from '@nestjs/common';
import { MachineDocumentsController } from './machine-documents.controller';
import { MachineDocumentsService } from './machine-documents.service';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MachineDocumentsController],
  providers: [MachineDocumentsService],
  exports: [MachineDocumentsService],
})
export class MachineDocumentsModule {}
