import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile() {
    const company = await this.prisma.company.findFirst()
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
      currencyCode: map['company.currencyCode'] || 'SAR',
    }
  }

  async updateProfile(dto: Record<string, any>) {
    const company = await this.prisma.company.findFirst()
    if (!company) throw new NotFoundException('No company found')
    const companyData: Record<string, any> = {}
    if (dto.companyNameAr) companyData.name = dto.companyNameAr
    else if (dto.companyNameEn) companyData.name = dto.companyNameEn
    if (dto.phone) companyData.phone = dto.phone
    if (dto.email) companyData.email = dto.email
    if (dto.address) companyData.address = dto.address
    if (Object.keys(companyData).length > 0) {
      await this.prisma.company.update({ where: { id: company.id }, data: companyData })
    }
    const settingMap: Record<string, string> = {
      taxNumber: 'company.taxNumber',
      commercialRegister: 'company.commercialRegister',
      city: 'company.city',
      country: 'company.country',
      defaultLanguage: 'company.defaultLanguage',
      timezone: 'company.timezone',
      currencyCode: 'company.currencyCode',
    }
    for (const [field, key] of Object.entries(settingMap)) {
      if (dto[field] !== undefined) {
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(dto[field]), group: 'company', label: field, status: 'ACTIVE' },
          update: { value: String(dto[field]) },
        })
      }
    }
    return this.getProfile()
  }
}
