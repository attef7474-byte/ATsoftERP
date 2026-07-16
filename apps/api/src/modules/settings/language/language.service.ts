import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.systemSetting.findMany({ where: { group: 'language' } })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return {
      defaultLocale: map['language.defaultLocale'] || 'ar',
      fallbackLocale: map['language.fallbackLocale'] || 'en',
      rtlEnabled: map['language.rtlEnabled'] !== 'false',
      dateFormat: map['language.dateFormat'] || 'YYYY-MM-DD',
      timeFormat: map['language.timeFormat'] || 'HH:mm',
      numberFormat: map['language.numberFormat'] || 'ar-SA',
    }
  }

  async update(dto: Record<string, any>) {
    const settingMap: Record<string, string> = {
      defaultLocale: 'language.defaultLocale',
      fallbackLocale: 'language.fallbackLocale',
      rtlEnabled: 'language.rtlEnabled',
      dateFormat: 'language.dateFormat',
      timeFormat: 'language.timeFormat',
      numberFormat: 'language.numberFormat',
    }
    for (const [field, key] of Object.entries(settingMap)) {
      if (dto[field] !== undefined) {
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(dto[field]), group: 'language', label: field, status: 'ACTIVE' },
          update: { value: String(dto[field]) },
        })
      }
    }
    return this.get()
  }
}
