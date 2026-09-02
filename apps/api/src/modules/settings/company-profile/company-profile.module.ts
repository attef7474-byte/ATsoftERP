import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { CompanyProfileController } from './company-profile.controller'
import { CompanyProfileService } from './company-profile.service'
import { CompanyOperationalCurrencyPolicy } from './company-operational-currency.policy'
import { AuditModule } from '../../audit/audit.module'

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService, CompanyOperationalCurrencyPolicy],
  exports: [CompanyOperationalCurrencyPolicy],
})
export class CompanyProfileModule {}
