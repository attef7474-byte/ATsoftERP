import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { OverheadAllocationController } from './overhead-allocation.controller';
import { OverheadAllocationService } from './overhead-allocation.service';

@Module({ imports: [AuditModule], controllers: [OverheadAllocationController], providers: [OverheadAllocationService], exports: [OverheadAllocationService] })
export class OverheadAllocationModule {}
