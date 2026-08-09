import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

export interface AppearanceSettings {
  themeMode: string
  primaryColor: string
  accentColor: string
  colorIntensity: number
  gradientEnabled: boolean
  gradientStrength: number
  gradientFocus: string
  gradientDirection: string
  preset: string
  fontScale: string
  shadowDepth: string
  radius: string
  glassOpacity: number
  glassBlur: number
  compactMode: boolean
  sidebarCollapsed: boolean
  sidebarBg: string
  sidebarAccent: string
  sidebarDensity: string
  sidebarFont: string
  tableDensity: string
  showStatusBar: boolean
  showActionBar: boolean
}

const DEFAULTS: Record<string, string> = {
  themeMode: 'light',
  primaryColor: '#2563eb',
  accentColor: '#14b8a6',
  colorIntensity: '70',
  gradientEnabled: 'true',
  gradientStrength: '70',
  gradientFocus: 'BALANCED',
  gradientDirection: 'BILATERAL_CENTER',
  preset: 'REFERENCE_DEFAULT',
  fontScale: 'medium',
  shadowDepth: 'medium',
  radius: 'medium',
  glassOpacity: '0.72',
  glassBlur: '14',
  compactMode: 'false',
  sidebarCollapsed: 'false',
  sidebarBg: 'navy',
  sidebarAccent: 'teal',
  sidebarDensity: 'default',
  sidebarFont: 'normal',
  tableDensity: 'default',
  showStatusBar: 'true',
  showActionBar: 'true',
}

const STORAGE_KEYS: Record<keyof AppearanceSettings, string> = {
  themeMode: 'appearance.themeMode',
  primaryColor: 'appearance.primaryColor',
  accentColor: 'appearance.accentColor',
  colorIntensity: 'appearance.colorIntensity',
  gradientEnabled: 'appearance.gradientEnabled',
  gradientStrength: 'appearance.gradientStrength',
  gradientFocus: 'appearance.gradientFocus',
  gradientDirection: 'appearance.gradientDirection',
  preset: 'appearance.preset',
  fontScale: 'appearance.fontScale',
  shadowDepth: 'appearance.shadowDepth',
  radius: 'appearance.radius',
  glassOpacity: 'appearance.glassOpacity',
  glassBlur: 'appearance.glassBlur',
  compactMode: 'appearance.compactMode',
  sidebarCollapsed: 'appearance.sidebarCollapsed',
  sidebarBg: 'appearance.sidebarBg',
  sidebarAccent: 'appearance.sidebarAccent',
  sidebarDensity: 'appearance.sidebarDensity',
  sidebarFont: 'appearance.sidebarFont',
  tableDensity: 'appearance.tableDensity',
  showStatusBar: 'appearance.showStatusBar',
  showActionBar: 'appearance.showActionBar',
}

const BOOLEAN_FIELDS = new Set<keyof AppearanceSettings>([
  'gradientEnabled',
  'compactMode',
  'sidebarCollapsed',
  'showStatusBar',
  'showActionBar',
])

const NUMBER_FIELDS = new Set<keyof AppearanceSettings>([
  'colorIntensity',
  'gradientStrength',
  'glassOpacity',
  'glassBlur',
])

const PRESET_VALUES: Record<string, Partial<Record<keyof AppearanceSettings, string>>> = {
  REFERENCE_DEFAULT: { ...DEFAULTS },
  MUTED: { gradientStrength: '35', colorIntensity: '35', gradientFocus: 'SOFT' },
  MEDIUM: { gradientStrength: '60', colorIntensity: '55', gradientFocus: 'BALANCED' },
  CONCENTRATED: { gradientStrength: '90', colorIntensity: '85', gradientFocus: 'CONCENTRATED' },
  GLASS: { glassOpacity: '0.55', glassBlur: '22', gradientStrength: '55' },
  CALM: { gradientStrength: '45', colorIntensity: '40', gradientFocus: 'SOFT' },
  FLAT: { gradientEnabled: 'false', gradientStrength: '0' },
}

@Injectable()
export class AppearanceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AppearanceSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { group: 'appearance' },
    })
    const map: Record<string, string> = {}
    for (const row of rows) map[row.key] = row.value
    if (map['appearance.shadowDepth'] === undefined && map['appearance.shadow'] !== undefined) {
      map['appearance.shadowDepth'] = map['appearance.shadow']
    }

    const result: Record<string, unknown> = {}
    for (const field of Object.keys(DEFAULTS) as (keyof AppearanceSettings)[]) {
      const raw = map[STORAGE_KEYS[field]] ?? DEFAULTS[field]
      if (BOOLEAN_FIELDS.has(field)) {
        result[field] = raw === 'true'
      } else if (NUMBER_FIELDS.has(field)) {
        const parsed = Number(raw)
        result[field] = Number.isFinite(parsed) ? parsed : Number(DEFAULTS[field])
      } else {
        result[field] = raw
      }
    }
    return result as unknown as AppearanceSettings
  }

  private async upsertField(field: keyof AppearanceSettings, stored: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: STORAGE_KEYS[field] },
      create: {
        key: STORAGE_KEYS[field],
        value: stored,
        group: 'appearance',
        label: field,
        status: 'ACTIVE',
      },
      update: { value: stored },
    })
  }

  async update(dto: Record<string, unknown>): Promise<AppearanceSettings> {
    const requestedPreset = dto['preset'] as string | undefined
    if (requestedPreset !== undefined && PRESET_VALUES[requestedPreset]) {
      for (const field of Object.keys(PRESET_VALUES[requestedPreset]) as (keyof AppearanceSettings)[]) {
        const stored = PRESET_VALUES[requestedPreset][field] as string
        if (stored !== undefined) await this.upsertField(field, stored)
      }
    }
    for (const field of Object.keys(STORAGE_KEYS) as (keyof AppearanceSettings)[]) {
      const value = dto[field]
      if (value === undefined) continue
      await this.upsertField(field, String(value))
    }
    return this.get()
  }
}
