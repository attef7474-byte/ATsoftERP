import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { NotificationRulesController } from './notification-rules.controller'
import { NotificationRulesService } from './notification-rules.service'

@Module({
  imports: [PrismaModule],
  controllers: [NotificationRulesController],
  providers: [NotificationRulesService],
})
export class NotificationRulesModule {}
