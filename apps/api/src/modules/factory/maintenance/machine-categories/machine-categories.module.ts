import { Module } from '@nestjs/common';
import { MachineCategoriesController } from './machine-categories.controller';
import { MachineCategoriesService } from './machine-categories.service';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MachineCategoriesController],
  providers: [MachineCategoriesService],
  exports: [MachineCategoriesService],
})
export class MachineCategoriesModule {}
