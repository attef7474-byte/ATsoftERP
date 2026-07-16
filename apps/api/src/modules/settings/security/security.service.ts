import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.systemSetting.findMany({ where: { group: 'security' } })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return {
      passwordMinLength: Number(map['security.passwordMinLength']) || 8,
      passwordRequireUppercase: map['security.passwordRequireUppercase'] !== 'false',
      passwordRequireLowercase: map['security.passwordRequireLowercase'] !== 'false',
      passwordRequireNumber: map['security.passwordRequireNumber'] !== 'false',
      passwordRequireSymbol: map['security.passwordRequireSymbol'] !== 'false',
      sessionTimeoutMinutes: Number(map['security.sessionTimeoutMinutes']) || 60,
      maxLoginAttempts: Number(map['security.maxLoginAttempts']) || 5,
      lockoutMinutes: Number(map['security.lockoutMinutes']) || 15,
      twoFactorEnabledDefault: map['security.twoFactorEnabledDefault'] === 'true',
      auditSensitiveActions: map['security.auditSensitiveActions'] !== 'false',
    }
  }

  async update(dto: Record<string, any>) {
    const settingMap: Record<string, string> = {
      passwordMinLength: 'security.passwordMinLength',
      passwordRequireUppercase: 'security.passwordRequireUppercase',
      passwordRequireLowercase: 'security.passwordRequireLowercase',
      passwordRequireNumber: 'security.passwordRequireNumber',
      passwordRequireSymbol: 'security.passwordRequireSymbol',
      sessionTimeoutMinutes: 'security.sessionTimeoutMinutes',
      maxLoginAttempts: 'security.maxLoginAttempts',
      lockoutMinutes: 'security.lockoutMinutes',
      twoFactorEnabledDefault: 'security.twoFactorEnabledDefault',
      auditSensitiveActions: 'security.auditSensitiveActions',
    }
    for (const [field, key] of Object.entries(settingMap)) {
      if (dto[field] !== undefined) {
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(dto[field]), group: 'security', label: field, status: 'ACTIVE' },
          update: { value: String(dto[field]) },
        })
      }
    }
    return this.get()
  }
}
