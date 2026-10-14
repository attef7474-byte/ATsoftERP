import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductUomConversionService } from './product-uom-conversion.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductUomConversionService],
  exports: [ProductsService, ProductUomConversionService],
})
export class ProductsModule {}
