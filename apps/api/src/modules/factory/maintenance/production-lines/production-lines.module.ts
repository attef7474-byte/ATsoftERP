import { Module } from '@nestjs/common';
import { ProductionLinesController } from './production-lines.controller';
import { ProductionLinesService } from './production-lines.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ProductionLinesController],
  providers: [ProductionLinesService],
  exports: [ProductionLinesService],
})
export class ProductionLinesModule {}
