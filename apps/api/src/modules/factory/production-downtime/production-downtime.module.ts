import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ProductionDowntimeController } from './production-downtime.controller';
import { ProductionDowntimeService } from './production-downtime.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductionDowntimeController],
  providers: [ProductionDowntimeService],
  exports: [ProductionDowntimeService],
})
export class ProductionDowntimeModule {}
