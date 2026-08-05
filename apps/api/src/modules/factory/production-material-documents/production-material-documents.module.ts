import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { ProductionMaterialDocumentsController } from './production-material-documents.controller';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [ProductionMaterialDocumentsController],
  providers: [ProductionMaterialDocumentsService],
  exports: [ProductionMaterialDocumentsService],
})
export class ProductionMaterialDocumentsModule {}
