import { Module } from '@nestjs/common';
import { OperationalSourceChangesService } from './operational-source-changes.service';

@Module({
  providers: [OperationalSourceChangesService],
  exports: [OperationalSourceChangesService],
})
export class OperationalSourceChangesModule {}
