import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { BarcodeLabelsController } from './barcode-labels.controller';
import { BarcodeLabelsService } from './barcode-labels.service';
import { BarcodePrintJobsController } from './barcode-print-jobs.controller';
import { BarcodePrintJobsService } from './barcode-print-jobs.service';
import { BarcodeScansController } from './barcode-scans.controller';
import { BarcodeScansService } from './barcode-scans.service';
import { BarcodeTemplatesController } from './barcode-templates.controller';
import { BarcodeTemplatesService } from './barcode-templates.service';

@Module({
  imports: [AuditModule],
  controllers: [BarcodeLabelsController, BarcodePrintJobsController, BarcodeScansController, BarcodeTemplatesController],
  providers: [BarcodeLabelsService, BarcodePrintJobsService, BarcodeScansService, BarcodeTemplatesService],
  exports: [BarcodeLabelsService, BarcodeScansService],
})
export class BarcodesModule {}
