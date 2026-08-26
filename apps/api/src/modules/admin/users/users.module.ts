import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UserActivityController } from './user-activity.controller'
import { AuditModule } from '../../audit/audit.module'
import { SecurityModule } from '../../settings/security/security.module'

@Module({
  imports: [AuditModule, SecurityModule],
  controllers: [UsersController, UserActivityController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
