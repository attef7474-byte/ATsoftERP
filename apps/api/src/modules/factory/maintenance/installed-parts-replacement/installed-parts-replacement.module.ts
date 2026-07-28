import { Module } from '@nestjs/common';
import { InstalledPartsReplacementController } from './installed-parts-replacement.controller';
import { InstalledPartsReplacementService } from './installed-parts-replacement.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InstalledPartsReplacementController],
  providers: [InstalledPartsReplacementService],
  exports: [InstalledPartsReplacementService],
})
export class InstalledPartsReplacementModule {}
