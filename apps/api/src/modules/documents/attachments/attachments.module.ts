import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsService } from './attachments.service'

@Module({
  imports: [PrismaModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
