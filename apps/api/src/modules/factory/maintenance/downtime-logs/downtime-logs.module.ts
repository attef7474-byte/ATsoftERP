import { Module } from '@nestjs/common';
import { DowntimeLogsController } from './downtime-logs.controller';
import { DowntimeLogsService } from './downtime-logs.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DowntimeLogsController],
  providers: [DowntimeLogsService],
  exports: [DowntimeLogsService],
})
export class DowntimeLogsModule {}
