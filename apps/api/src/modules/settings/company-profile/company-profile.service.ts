import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { AuditService } from '../../audit/audit.service'
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto'
import {
  COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS,
  CompanyOperationalCurrencyPolicy,
} from './company-operational-currency.policy'

const COMPANY_OPERATIONAL_CURRENCY_AUDIT_ENTITY = 'Company'
const COMPANY_OPERATIONAL_CURRENCY_AUDIT_ACTION = 'OPERATIONAL_CURRENCY_CHANGE'

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly currencyPolicy: CompanyOperationalCurrencyPolicy,
  ) {}

  async getProfile(ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findFirst({
      where: { id: ctx.companyId, deletedAt: null },
    })
    if (!company) throw new NotFoundException('No company found')
    const settings = await this.prisma.systemSetting.findMany({
      where: { group: 'company' },
    })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return {
      id: company.id,
      companyNameAr: company.name,
      companyNameEn: company.name,
      taxNumber: map['company.taxNumber'] || '',
      commercialRegister: map['company.commercialRegister'] || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      city: map['company.city'] || '',
      country: map['company.country'] || '',
      defaultLanguage: map['company.defaultLanguage'] || 'ar',
      timezone: map['company.timezone'] || 'Asia/Riyadh',
      // Retained only for backward response compatibility. It is not the
      // operational ledger currency authority.
      currencyCode: map['company.currencyCode'] || 'SAR',
      operationalCurrencyCode: company.operationalCurrencyCode ?? null,
    }
  }

  async updateProfile(
    dto: UpdateCompanyProfileDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: ctx.companyId, deletedAt: null },
    })
    if (!company) throw new NotFoundException('No company found')

    const companyData: Record<string, unknown> = {}
    if (dto.companyNameAr) companyData.name = dto.companyNameAr
    else if (dto.companyNameEn) companyData.name = dto.companyNameEn
    if (dto.phone) companyData.phone = dto.phone
    if (dto.email) companyData.email = dto.email
    if (dto.address) companyData.address = dto.address

    const hasCurrencyMutation = Object.prototype.hasOwnProperty.call(dto, 'operationalCurrencyCode')
    const requestedCurrency = hasCurrencyMutation
      ? this.currencyPolicy.normalizeNullable(dto.operationalCurrencyCode ?? null)
      : company.operationalCurrencyCode
    const currencyChanged = hasCurrencyMutation && requestedCurrency !== company.operationalCurrencyCode
    if (currencyChanged) companyData.operationalCurrencyCode = requestedCurrency

    const settingMap: Record<string, string> = {
      taxNumber: 'company.taxNumber',
      commercialRegister: 'company.commercialRegister',
      city: 'company.city',
      country: 'company.country',
      defaultLanguage: 'company.defaultLanguage',
      timezone: 'company.timezone',
    }
    const settingChanges = Object.entries(settingMap).filter(
      ([field]) => dto[field as keyof UpdateCompanyProfileDto] !== undefined,
    )

    await this.prisma.$transaction(async (tx) => {
      if (currencyChanged) {
        const existingCostRows = await tx.operationalCostTransaction.count({
          where: { companyId: ctx.companyId },
        })
        if (existingCostRows > 0) {
          throw new ConflictException({
            messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.frozen,
            message: 'Operational currency cannot change after the first operational cost posting',
          })
        }
      }

      if (Object.keys(companyData).length > 0) {
        await tx.company.update({ where: { id: company.id }, data: companyData })
      }
      for (const [field, key] of settingChanges) {
        const value = dto[field as keyof UpdateCompanyProfileDto]
        await tx.systemSetting.upsert({
          where: { key },
          create: { key, value: String(value), group: 'company', label: field, status: 'ACTIVE' },
          update: { value: String(value) },
        })
      }
      if (currencyChanged) {
        await this.audit.logWithClient(tx, {
          userId,
          action: COMPANY_OPERATIONAL_CURRENCY_AUDIT_ACTION,
          entity: COMPANY_OPERATIONAL_CURRENCY_AUDIT_ENTITY,
          entityId: company.id,
          details: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            before: company.operationalCurrencyCode ?? null,
            after: requestedCurrency,
          },
        })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return this.getProfile(ctx)
  }
}
