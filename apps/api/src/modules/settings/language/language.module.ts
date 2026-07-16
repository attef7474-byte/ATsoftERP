import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { LanguageController } from './language.controller'
import { LanguageService } from './language.service'

@Module({
  imports: [PrismaModule],
  controllers: [LanguageController],
  providers: [LanguageService],
})
export class LanguageModule {}
