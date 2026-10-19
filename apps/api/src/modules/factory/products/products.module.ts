import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { ProductionMasterDataModule } from '../production-master-data/production-master-data.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductAggregateService } from './product-aggregate.service';
import { ProductUomConversionService } from './product-uom-conversion.service';

@Module({
  imports: [AuditModule, ProductionMasterDataModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductUomConversionService, ProductAggregateService, PermissionCheckService],
  exports: [ProductsService, ProductUomConversionService],
})
export class ProductsModule {}
