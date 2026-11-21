import { Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { resolvePasswordPolicy } from './password-policy'

type AuditActor = { id?: string; sub?: string; employeeId?: string | null }

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional injection: modules are owned by another integration step.
    @Optional() private auditService?: AuditService,
  ) {}

  private get audit(): AuditService | undefined {
    // Guard test doubles that omit auditLog; real PrismaService always exposes it.
    if (!this.auditService && (this.prisma as any).auditLog?.create) this.auditService = new AuditService(this.prisma)
    return this.auditService
  }

  private auditIdentity(actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const candidate = actor ?? (ctx as any)?.actor ?? (ctx as any)?.user
    return {
      userId: actor?.id ?? actor?.sub ?? (ctx as any)?.userId ?? (ctx as any)?.actorUserId,
      employeeId: candidate?.employeeId ?? null,
    }
  }

  private auditScope(ctx?: ActiveOperationalContext) {
    return {
      companyId: ctx?.companyId ?? null,
      branchId: ctx?.branchId ?? null,
      scope: ctx ? ctx.source : 'GLOBAL',
    }
  }

  async get() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { group: 'security', status: 'ACTIVE' },
    })
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    const passwordPolicy = resolvePasswordPolicy(settings)
    return {
      passwordMinLength: passwordPolicy.minLength,
      passwordRequireUppercase: passwordPolicy.requireUppercase,
      passwordRequireLowercase: passwordPolicy.requireLowercase,
      passwordRequireNumber: passwordPolicy.requireNumber,
      passwordRequireSymbol: passwordPolicy.requireSymbol,
      passwordMaxBytes: passwordPolicy.maxBytes,
      sessionTimeoutMinutes: Number(map['security.sessionTimeoutMinutes']) || 60,
      maxLoginAttempts: Number(map['security.maxLoginAttempts']) || 5,
      lockoutMinutes: Number(map['security.lockoutMinutes']) || 15,
      twoFactorEnabledDefault: map['security.twoFactorEnabledDefault'] === 'true',
      auditSensitiveActions: map['security.auditSensitiveActions'] !== 'false',
    }
  }

  async update(dto: Record<string, any>, actor?: AuditActor, ctx?: ActiveOperationalContext) {
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
    const previousSettings = await this.prisma.systemSetting.findMany({
      where: { group: 'security', status: 'ACTIVE' },
      select: { key: true, value: true },
    })
    const previous: Record<string, string | null> = {}
    for (const s of previousSettings) previous[s.key] = s.value

    const next: Record<string, string> = {}
    for (const [field, key] of Object.entries(settingMap)) {
      if (dto[field] !== undefined) {
        next[key] = String(dto[field])
        await this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(dto[field]), group: 'security', label: field, status: 'ACTIVE' },
          update: { value: String(dto[field]) },
        })
      }
    }
    if (Object.keys(next).length > 0) {
      const identity = this.auditIdentity(actor, ctx)
      const previousForChanged: Record<string, string | null> = {}
      for (const key of Object.keys(next)) previousForChanged[key] = previous[key] ?? null
      await this.audit?.log(identity.userId, 'SECURITY_SETTINGS_UPDATE', 'SecuritySettings', 'security', {
        ...this.auditScope(ctx),
        ...identity,
        reason: 'SECURITY_SETTINGS_UPDATE',
        changedFields: Object.keys(next),
        previous: previousForChanged,
        next,
      })
    }
    return this.get()
  }
}
