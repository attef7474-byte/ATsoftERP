import { Module } from '@nestjs/common'
import { PrismaModule } from './common/prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/admin/users/users.module'
import { RolesModule } from './modules/admin/roles/roles.module'
import { PermissionsModule } from './modules/admin/permissions/permissions.module'
import { BranchesModule } from './modules/admin/branches/branches.module'
import { AdministrationsModule } from './modules/admin/administrations/administrations.module'
import { DepartmentsModule } from './modules/admin/departments/departments.module'
import { OrganizationalUnitsModule } from './modules/admin/organizational-units/organizational-units.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { ProductsModule } from './modules/factory/products/products.module'
import { ProductCategoriesModule } from './modules/factory/product-categories/product-categories.module'
import { InventoryModule } from './modules/factory/inventory/inventory.module'
import { MaintenanceModule } from './modules/factory/maintenance/maintenance.module'
import { AuditModule } from './modules/audit/audit.module'
import { MachineCategoriesModule } from './modules/factory/maintenance/machine-categories/machine-categories.module'
import { MaintenanceDashboardModule } from './modules/factory/maintenance/maintenance-dashboard/maintenance-dashboard.module'
import { MachinePartsModule } from './modules/factory/maintenance/machine-parts/machine-parts.module'
import { MachineDocumentsModule } from './modules/factory/maintenance/machine-documents/machine-documents.module'
import { MaintenanceRequestsModule } from './modules/factory/maintenance/maintenance-requests/maintenance-requests.module'
import { MaintenanceWorkOrdersModule } from './modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.module'
import { MaintenanceTasksModule } from './modules/factory/maintenance/maintenance-tasks/maintenance-tasks.module'
import { MaintenanceSchedulesModule } from './modules/factory/maintenance/maintenance-schedules/maintenance-schedules.module'
import { MaintenanceChecklistItemsModule } from './modules/factory/maintenance/maintenance-checklist-items/maintenance-checklist-items.module'
import { DowntimeLogsModule } from './modules/factory/maintenance/downtime-logs/downtime-logs.module'
import { MaintenanceRequestPartsModule } from './modules/factory/maintenance/maintenance-request-parts/maintenance-request-parts.module'
import { MaintenanceRequestCostsModule } from './modules/factory/maintenance/maintenance-request-costs/maintenance-request-costs.module'
import { MaintenanceChecklistExecutionsModule } from './modules/factory/maintenance/maintenance-checklist-executions/maintenance-checklist-executions.module'
import { PreventiveMaintenanceModule } from './modules/factory/maintenance/preventive-maintenance/preventive-maintenance.module'
import { OperationTypesModule } from './modules/factory/maintenance/operation-types/operation-types.module'
import { CostCentersModule } from './modules/factory/maintenance/cost-centers/cost-centers.module'
import { ProductionLinesModule } from './modules/factory/maintenance/production-lines/production-lines.module'
import { MachineComponentsModule } from './modules/factory/maintenance/machine-components/machine-components.module'
import { SparePartsModule } from './modules/factory/maintenance/spare-parts/spare-parts.module'
import { ComponentSparePartsModule } from './modules/factory/maintenance/component-spare-parts/component-spare-parts.module'
import { MachineSparePartsModule } from './modules/factory/maintenance/machine-spare-parts/machine-spare-parts.module'
import { MaintenancePersonnelModule } from './modules/factory/maintenance/maintenance-personnel/maintenance-personnel.module'
import { MachineResponsibilityAssignmentsModule } from './modules/factory/maintenance/machine-responsibility-assignments/machine-responsibility-assignments.module'
import { MaintenanceRequestAssignmentsModule } from './modules/factory/maintenance/maintenance-request-assignments/maintenance-request-assignments.module'
import { MaintenancePartAccountabilityModule } from './modules/factory/maintenance/maintenance-part-accountability/maintenance-part-accountability.module'
import { InventoryCountsModule } from './modules/factory/inventory-counts/inventory-counts.module'
import { InventoryCountLinesModule } from './modules/factory/inventory-count-lines/inventory-count-lines.module'
import { InventoryMovementsModule } from './modules/factory/inventory-movements/inventory-movements.module'
import { InventoryAdjustmentsModule } from './modules/factory/inventory-adjustments/inventory-adjustments.module'
import { InventoryBalancesModule } from './modules/factory/inventory-balances/inventory-balances.module'
import { BusinessPartnersModule } from './modules/business-partners/business-partners.module'
import { BarcodesModule } from './modules/barcodes/barcodes.module'
import { SystemSettingsModule } from './modules/settings/system-settings/system-settings.module'
import { NumberingModule } from './modules/numbering/numbering.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { SearchModule } from './modules/search/search.module'
import { ReportsModule } from './modules/reports/reports.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { CompanyProfileModule } from './modules/settings/company-profile/company-profile.module'
import { LanguageModule } from './modules/settings/language/language.module'
import { AppearanceModule } from './modules/settings/appearance/appearance.module'
import { SecurityModule } from './modules/settings/security/security.module'
import { NotificationRulesModule } from './modules/settings/notification-rules/notification-rules.module'
import { AttachmentsModule } from './modules/documents/attachments/attachments.module'
import { MessagingModule } from './modules/messaging/messaging.module'
import { MaintenanceReliabilityModule } from './modules/factory/maintenance/maintenance-reliability/maintenance-reliability.module'
import { MaintenanceSparePartRequestLinesModule } from './modules/factory/maintenance/maintenance-spare-part-request-lines/maintenance-spare-part-request-lines.module'
import { MaintenanceNotificationModule } from './modules/factory/maintenance/maintenance-notification/maintenance-notification.module'
import { MaintenanceSlaModule } from './modules/factory/maintenance/maintenance-sla/maintenance-sla.module'
import { MaintenanceCalendarWorkloadModule } from './modules/factory/maintenance/maintenance-calendar-workload/maintenance-calendar-workload.module'
import { MaintenanceStockIssueModule } from './modules/factory/maintenance/maintenance-stock-issue/maintenance-stock-issue.module'
import { SparePartConditionModule } from './modules/factory/maintenance/spare-part-conditions/spare-part-conditions.module'
import { InstalledPartsReplacementModule } from './modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.module'
import { RepairOrdersModule } from './modules/factory/maintenance/repair-orders/repair-orders.module'
import { MaintenanceBomModule } from './modules/factory/maintenance/maintenance-bom/maintenance-bom.module'
import { PreventiveSparePartPlanModule } from './modules/factory/maintenance/preventive-spare-part-plan/preventive-spare-part-plan.module'
import { InventoryLedgerReconciliationModule } from './modules/factory/inventory-ledger-reconciliation/inventory-ledger-reconciliation.module'
import { InventoryOpeningBalancesModule } from './modules/factory/inventory-opening-balances/inventory-opening-balances.module'
import { InventoryStockAdjustmentsModule } from './modules/factory/inventory-stock-adjustments/inventory-stock-adjustments.module'
import { InventoryStockTransfersModule } from './modules/factory/inventory-stock-transfers/inventory-stock-transfers.module'
import { InventoryOperationalReceiptsModule } from './modules/factory/inventory-operational-receipts/inventory-operational-receipts.module'
import { InventoryPhysicalCountsModule } from './modules/factory/inventory-physical-counts/inventory-physical-counts.module'
import { InventoryLocksModule } from './modules/factory/inventory-locks/inventory-locks.module'
import { ProductionMasterDataModule } from './modules/factory/production-master-data/production-master-data.module'
import { ProductionShiftsModule } from './modules/factory/production-shifts/production-shifts.module'
import { ProductionCapacityStandardsModule } from './modules/factory/production-capacity-standards/production-capacity-standards.module'
import { ProductionOrdersModule } from './modules/factory/production-orders/production-orders.module'
import { ProductionRunsModule } from './modules/factory/production-runs/production-runs.module';
import { ProductionLossReasonsModule } from './modules/factory/production-loss-reasons/production-loss-reasons.module';
import { ProductionDowntimeModule } from './modules/factory/production-downtime/production-downtime.module';
import { ProductionLossQuantityEventsModule } from './modules/factory/production-loss-quantity-events/production-loss-quantity-events.module';

@Module({
  imports: [
    PrismaModule, HealthModule, AuthModule,
    UsersModule, RolesModule, PermissionsModule, BranchesModule, AdministrationsModule, DepartmentsModule, OrganizationalUnitsModule, CompaniesModule,
    ProductsModule, ProductCategoriesModule, InventoryModule, MaintenanceModule,
    AuditModule,
    MachineCategoriesModule, MachinePartsModule, MachineDocumentsModule,
    MaintenanceRequestsModule, MaintenanceTasksModule, MaintenanceSchedulesModule,
    MaintenanceWorkOrdersModule,
    MaintenanceChecklistItemsModule, DowntimeLogsModule,
    MaintenanceRequestPartsModule, MaintenanceRequestCostsModule, MaintenanceChecklistExecutionsModule,
    MaintenanceDashboardModule, PreventiveMaintenanceModule,
    OperationTypesModule, CostCentersModule, ProductionLinesModule, MachineComponentsModule,
    SparePartsModule, ComponentSparePartsModule, MachineSparePartsModule,
    MaintenancePersonnelModule, MachineResponsibilityAssignmentsModule, MaintenanceRequestAssignmentsModule, MaintenancePartAccountabilityModule,
    InventoryCountsModule, InventoryCountLinesModule, InventoryMovementsModule,
    InventoryAdjustmentsModule, InventoryBalancesModule,
    BusinessPartnersModule,     BarcodesModule,
    CompanyProfileModule, LanguageModule, AppearanceModule, SecurityModule, NotificationRulesModule,
    SystemSettingsModule, NumberingModule, NotificationsModule, ReportsModule, SearchModule,
    DashboardModule, AlertsModule,
    AttachmentsModule,
    MessagingModule,
    MaintenanceReliabilityModule,
    MaintenanceSparePartRequestLinesModule,
    MaintenanceNotificationModule,
    MaintenanceSlaModule,
    MaintenanceCalendarWorkloadModule,
    MaintenanceStockIssueModule,
    SparePartConditionModule,
    InstalledPartsReplacementModule,
    RepairOrdersModule,
    MaintenanceBomModule,
    PreventiveSparePartPlanModule,
    InventoryLedgerReconciliationModule,
    InventoryOpeningBalancesModule,
    InventoryStockAdjustmentsModule,
    InventoryStockTransfersModule,
    InventoryOperationalReceiptsModule,
    InventoryPhysicalCountsModule,
    InventoryLocksModule,
    ProductionMasterDataModule,
    ProductionShiftsModule,
    ProductionCapacityStandardsModule,
    ProductionOrdersModule,
    ProductionRunsModule,
    ProductionLossReasonsModule,
    ProductionDowntimeModule,
    ProductionLossQuantityEventsModule,
  ],
})
export class AppModule {}