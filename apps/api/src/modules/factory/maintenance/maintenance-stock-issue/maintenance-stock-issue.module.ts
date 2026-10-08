import { Module } from '@nestjs/common';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { SparePartConditionModule } from '../spare-part-conditions/spare-part-conditions.module';
import { InstalledPartsReplacementModule } from '../installed-parts-replacement/installed-parts-replacement.module';
import { InventoryValuationModule } from '../../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { ProductionCostModule } from '../../production-cost/production-cost.module';

/**
 * R4R — the maintenance stock-issue authority is now INTERNAL.
 *
 * This module used to expose `POST /maintenance/requests/:requestId/parts/:lineId/
 * stock-issue/issue`, which nested the warehouse transaction inside the maintenance
 * request resource. That route is removed: the canonical entry point is
 * SparePartIssuesController (`/api/v1/spare-part-issues`), which delegates here.
 * MaintenanceStockIssueService remains the single implementation that creates the
 * inventory movement, decrements the balance, moves the condition balance, records the
 * installed part and posts the cost ledger entry.
 */
@Module({
  imports: [AuditModule, SparePartConditionModule, InstalledPartsReplacementModule, InventoryValuationModule, ProductionCostModule],
  controllers: [],
  providers: [MaintenanceStockIssueService, InventoryValuationEngineService],
  exports: [MaintenanceStockIssueService],
})
export class MaintenanceStockIssueModule {}
