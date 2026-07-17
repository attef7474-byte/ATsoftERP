import { Module } from '@nestjs/common'
import { PrismaModule } from './common/prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/admin/users/users.module'
import { RolesModule } from './modules/admin/roles/roles.module'
import { PermissionsModule } from './modules/admin/permissions/permissions.module'
import { BranchesModule } from './modules/admin/branches/branches.module'
import { DepartmentsModule } from './modules/admin/departments/departments.module'
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
import { MaintenanceTasksModule } from './modules/factory/maintenance/maintenance-tasks/maintenance-tasks.module'
import { MaintenanceSchedulesModule } from './modules/factory/maintenance/maintenance-schedules/maintenance-schedules.module'
import { MaintenanceChecklistItemsModule } from './modules/factory/maintenance/maintenance-checklist-items/maintenance-checklist-items.module'
import { DowntimeLogsModule } from './modules/factory/maintenance/downtime-logs/downtime-logs.module'
import { MaintenanceRequestPartsModule } from './modules/factory/maintenance/maintenance-request-parts/maintenance-request-parts.module'
import { MaintenanceRequestCostsModule } from './modules/factory/maintenance/maintenance-request-costs/maintenance-request-costs.module'
import { MaintenanceChecklistExecutionsModule } from './modules/factory/maintenance/maintenance-checklist-executions/maintenance-checklist-executions.module'
import { PreventiveMaintenanceModule } from './modules/factory/maintenance/preventive-maintenance/preventive-maintenance.module'
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
import { ReportsModule } from './modules/reports/reports.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { CompanyProfileModule } from './modules/settings/company-profile/company-profile.module'
import { LanguageModule } from './modules/settings/language/language.module'
import { AppearanceModule } from './modules/settings/appearance/appearance.module'
import { SecurityModule } from './modules/settings/security/security.module'
import { NotificationRulesModule } from './modules/settings/notification-rules/notification-rules.module'
import { AttachmentsModule } from './modules/documents/attachments/attachments.module'

@Module({
  imports: [
    PrismaModule, HealthModule, AuthModule,
    UsersModule, RolesModule, PermissionsModule, BranchesModule, DepartmentsModule, CompaniesModule,
    ProductsModule, ProductCategoriesModule, InventoryModule, MaintenanceModule,
    AuditModule,
    MachineCategoriesModule, MachinePartsModule, MachineDocumentsModule,
    MaintenanceRequestsModule, MaintenanceTasksModule, MaintenanceSchedulesModule,
    MaintenanceChecklistItemsModule, DowntimeLogsModule,
    MaintenanceRequestPartsModule, MaintenanceRequestCostsModule, MaintenanceChecklistExecutionsModule,
    MaintenanceDashboardModule, PreventiveMaintenanceModule,
    InventoryCountsModule, InventoryCountLinesModule, InventoryMovementsModule,
    InventoryAdjustmentsModule, InventoryBalancesModule,
    BusinessPartnersModule, BarcodesModule,
    SystemSettingsModule, NumberingModule, NotificationsModule, ReportsModule,
    DashboardModule, AlertsModule,
    CompanyProfileModule, LanguageModule, AppearanceModule, SecurityModule, NotificationRulesModule,
    AttachmentsModule,
  ],
})
export class AppModule {}
