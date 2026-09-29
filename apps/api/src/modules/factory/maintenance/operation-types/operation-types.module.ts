import { Module } from '@nestjs/common';
import { OperationTypesController } from './operation-types.controller';
import { OperationTypesService } from './operation-types.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { OperationalContextModule } from '../../../../common/operational-context/operational-context.module';

@Module({
  // OperationalContextModule is @Global, but importing it explicitly documents
  // the dependency: restore() re-resolves SUPER_ADMIN authority from the
  // database through AllowedContextResolver on every call.
  imports: [AuditModule, OperationalContextModule],
  controllers: [OperationTypesController],
  providers: [OperationTypesService],
  exports: [OperationTypesService],
})
export class OperationTypesModule {}
