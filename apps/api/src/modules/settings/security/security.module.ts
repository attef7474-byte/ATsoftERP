import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { SecurityController } from './security.controller'
import { SecurityService } from './security.service'
import { PasswordCredentialService } from './password-credential.service'

@Module({
  imports: [PrismaModule],
  controllers: [SecurityController],
  providers: [SecurityService, PasswordCredentialService],
  exports: [SecurityService, PasswordCredentialService],
})
export class SecurityModule {}
