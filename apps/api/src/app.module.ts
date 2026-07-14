import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/admin/users/users.module';
import { RolesModule } from './modules/admin/roles/roles.module';
import { PermissionsModule } from './modules/admin/permissions/permissions.module';
import { BranchesModule } from './modules/admin/branches/branches.module';
import { DepartmentsModule } from './modules/admin/departments/departments.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProductsModule } from './modules/factory/products/products.module';
import { ProductCategoriesModule } from './modules/factory/product-categories/product-categories.module';
import { InventoryModule } from './modules/factory/inventory/inventory.module';
import { MaintenanceModule } from './modules/factory/maintenance/maintenance.module';
import { AuditModule } from './common/audit/audit.module';
import { MachineCategoriesModule } from './modules/factory/maintenance/machine-categories/machine-categories.module';
import { MachinePartsModule } from './modules/factory/maintenance/machine-parts/machine-parts.module';
import { MachineDocumentsModule } from './modules/factory/maintenance/machine-documents/machine-documents.module';
import { MaintenanceRequestsModule } from './modules/factory/maintenance/maintenance-requests/maintenance-requests.module';
import { MaintenanceTasksModule } from './modules/factory/maintenance/maintenance-tasks/maintenance-tasks.module';
import { MaintenanceSchedulesModule } from './modules/factory/maintenance/maintenance-schedules/maintenance-schedules.module';
import { MaintenanceChecklistItemsModule } from './modules/factory/maintenance/maintenance-checklist-items/maintenance-checklist-items.module';
import { DowntimeLogsModule } from './modules/factory/maintenance/downtime-logs/downtime-logs.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    BranchesModule,
    DepartmentsModule,
    CompaniesModule,
    ProductsModule,
    ProductCategoriesModule,
    InventoryModule,
    MaintenanceModule,
    AuditModule,
    MachineCategoriesModule,
    MachinePartsModule,
    MachineDocumentsModule,
    MaintenanceRequestsModule,
    MaintenanceTasksModule,
    MaintenanceSchedulesModule,
    MaintenanceChecklistItemsModule,
    DowntimeLogsModule,
  ],
})
export class AppModule {}
