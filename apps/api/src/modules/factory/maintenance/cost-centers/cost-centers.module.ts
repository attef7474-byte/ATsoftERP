import { Module } from '@nestjs/common';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CostCentersController],
  providers: [CostCentersService],
  exports: [CostCentersService],
})
export class CostCentersModule {}
