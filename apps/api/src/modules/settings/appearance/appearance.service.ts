import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class AppearanceService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.systemSetting.findMany({ where: { group: 'appearance' } })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return {
      themeMode: map['appearance.themeMode'] || 'light',
      accentColor: map['appearance.accentColor'] || '#2563eb',
      compactMode: map['appearance.compactMode'] === 'true',
      sidebarDensity: map['appearance.sidebarDensity'] || 'default',
      tableDensity: map['appearance.tableDensity'] || 'default',
      showStatusBar: map['appearance.showStatusBar'] !== 'false',
      showActionBar: map['appearance.showActionBar'] !== 'false',
    }
  }

  async update(dto: Record<string, any>) {
    const settingMap: Record<string, string> = {
      themeMode: 'appearance.themeMode',
      accentColor: 'appearance.accentColor',
      compactMode: 'appearance.compactMode',
      sidebarDensity: 'appearance.sidebarDensity',
      tableDensity: 'appearance.tableDensity',
      showStatusBar: 'appearance.showStatusBar',
      showActionBar: 'appearance.showActionBar',
    }
    for (const [field, key] of Object.entries(settingMap)) {
      if (dto[field] !== undefined) {
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(dto[field]), group: 'appearance', label: field, status: 'ACTIVE' },
          update: { value: String(dto[field]) },
        })
      }
    }
    return this.get()
  }
}
