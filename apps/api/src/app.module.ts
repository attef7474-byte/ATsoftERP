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
import { AuditModule } from './modules/audit/audit.module';

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
  ],
})
export class AppModule {}
