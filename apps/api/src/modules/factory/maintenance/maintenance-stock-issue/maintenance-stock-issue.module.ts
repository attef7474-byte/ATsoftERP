import { Module } from '@nestjs/common';
import { MaintenanceStockIssueController } from './maintenance-stock-issue.controller';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { SparePartConditionModule } from '../spare-part-conditions/spare-part-conditions.module';
import { InstalledPartsReplacementModule } from '../installed-parts-replacement/installed-parts-replacement.module';
import { InventoryValuationModule } from '../../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { ProductionCostModule } from '../../production-cost/production-cost.module';

@Module({
  imports: [AuditModule, SparePartConditionModule, InstalledPartsReplacementModule, InventoryValuationModule, ProductionCostModule],
  controllers: [MaintenanceStockIssueController],
  providers: [MaintenanceStockIssueService, InventoryValuationEngineService],
  exports: [MaintenanceStockIssueService],
})
export class MaintenanceStockIssueModule {}
