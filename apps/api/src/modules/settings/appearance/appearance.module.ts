import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { AppearanceController } from './appearance.controller'
import { AppearanceService } from './appearance.service'

@Module({
  imports: [PrismaModule],
  controllers: [AppearanceController],
  providers: [AppearanceService],
})
export class AppearanceModule {}
