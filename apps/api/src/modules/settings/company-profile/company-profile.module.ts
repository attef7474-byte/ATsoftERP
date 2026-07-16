import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { CompanyProfileController } from './company-profile.controller'
import { CompanyProfileService } from './company-profile.service'

@Module({
  imports: [PrismaModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
})
export class CompanyProfileModule {}
