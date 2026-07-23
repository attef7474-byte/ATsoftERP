import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../common/audit/audit.module';
import { ComponentSparePartsController } from './component-spare-parts.controller';
import { ComponentSparePartsService } from './component-spare-parts.service';

@Module({
  imports: [AuditModule],
  controllers: [ComponentSparePartsController],
  providers: [ComponentSparePartsService],
  exports: [ComponentSparePartsService],
})
export class ComponentSparePartsModule {}
