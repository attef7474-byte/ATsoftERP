import { Module } from '@nestjs/common';
import { ProductionUnitsController } from './production-units.controller';
import { ProductionUnitsService } from './production-units.service';
import { ProductionProductDefinitionsController } from './production-product-definitions.controller';
import { ProductionProductDefinitionsService } from './production-product-definitions.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';

@Module({
  imports: [AuditModule, NumberingModule],
  controllers: [ProductionUnitsController, ProductionProductDefinitionsController],
  providers: [ProductionUnitsService, ProductionProductDefinitionsService],
  exports: [ProductionUnitsService, ProductionProductDefinitionsService],
})
export class ProductionMasterDataModule {}
