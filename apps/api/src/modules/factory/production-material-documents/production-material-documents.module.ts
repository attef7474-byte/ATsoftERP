import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { OperationalSourceChangesModule } from '../operational-source-changes/operational-source-changes.module';
import { ProductionMaterialDocumentsController } from './production-material-documents.controller';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule, OperationalSourceChangesModule],
  controllers: [ProductionMaterialDocumentsController],
  providers: [ProductionMaterialDocumentsService],
  exports: [ProductionMaterialDocumentsService],
})
export class ProductionMaterialDocumentsModule {}
