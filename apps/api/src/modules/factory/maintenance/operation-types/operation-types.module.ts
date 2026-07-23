import { Module } from '@nestjs/common';
import { OperationTypesController } from './operation-types.controller';
import { OperationTypesService } from './operation-types.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OperationTypesController],
  providers: [OperationTypesService],
  exports: [OperationTypesService],
})
export class OperationTypesModule {}
