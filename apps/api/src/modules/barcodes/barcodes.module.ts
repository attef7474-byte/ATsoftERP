import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { BarcodeLabelsController } from './barcode-labels.controller';
import { BarcodeLabelsService } from './barcode-labels.service';
import { BarcodeScansController } from './barcode-scans.controller';
import { BarcodeScansService } from './barcode-scans.service';
import { BarcodeTemplatesController } from './barcode-templates.controller';
import { BarcodeTemplatesService } from './barcode-templates.service';

@Module({
  imports: [AuditModule],
  controllers: [BarcodeLabelsController, BarcodeScansController, BarcodeTemplatesController],
  providers: [BarcodeLabelsService, BarcodeScansService, BarcodeTemplatesService],
  exports: [BarcodeLabelsService, BarcodeScansService],
})
export class BarcodesModule {}
