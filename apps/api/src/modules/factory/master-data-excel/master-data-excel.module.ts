import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { MachineComponentsModule } from '../maintenance/machine-components/machine-components.module';
import { SparePartsModule } from '../maintenance/spare-parts/spare-parts.module';
import { ProductsModule } from '../products/products.module';
import { MasterDataExcelController } from './master-data-excel.controller';
import { MasterDataExcelService } from './master-data-excel.service';
@Module({ imports: [AuditModule, MaintenanceModule, MachineComponentsModule, SparePartsModule, ProductsModule], controllers: [MasterDataExcelController], providers: [MasterDataExcelService, PermissionCheckService] })
export class MasterDataExcelModule {}
