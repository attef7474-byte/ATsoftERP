import { Injectable, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreateSystemSettingDto } from '../dto/create-system-setting.dto';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';

type AuditActor = { id?: string; sub?: string; employeeId?: string | null };

@Injectable()
export class SystemSettingsService {
  constructor(
    private prisma: PrismaService,
    // Optional injection: modules are owned by another integration step.
    @Optional() private auditService?: AuditService,
  ) {}

  private get audit(): AuditService | undefined {
    // Guard test doubles that omit auditLog; real PrismaService always exposes it.
    if (!this.auditService && (this.prisma as any).auditLog?.create) this.auditService = new AuditService(this.prisma);
    return this.auditService;
  }

  private auditIdentity(actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const candidate = actor ?? (ctx as any)?.actor ?? (ctx as any)?.user;
    return {
      userId: actor?.id ?? actor?.sub ?? (ctx as any)?.userId ?? (ctx as any)?.actorUserId,
      employeeId: candidate?.employeeId ?? null,
    };
  }

  private auditScope(ctx?: ActiveOperationalContext) {
    return {
      companyId: ctx?.companyId ?? null,
      branchId: ctx?.branchId ?? null,
      scope: ctx ? ctx.source : 'GLOBAL',
    };
  }

  private auditValue(setting: { key: string; value: string }): string {
    return this.isSecretKey(setting.key) ? this.maskValue() : setting.value;
  }

  async create(dto: CreateSystemSettingDto, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException('Setting key already exists');
    const created = await this.prisma.systemSetting.create({ data: dto });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'CREATE', 'SystemSetting', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      next: { key: created.key, group: created.group, value: this.auditValue(created), status: created.status },
    });
    return created;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; group?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { key: { contains: query.search } },
        { label: { contains: query.search } },
      ];
    }
    if (query.group) where.group = query.group;

    const [data, total] = await Promise.all([
      this.prisma.systemSetting.findMany({ where, skip, take: limit, orderBy: { group: 'asc' } }),
      this.prisma.systemSetting.count({ where }),
    ]);

    const maskedData = data.map((setting) => ({
      ...setting,
      value: this.isSecretKey(setting.key) ? this.maskValue() : setting.value,
    }));

    return { data: maskedData, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id } });
    if (!setting) throw new NotFoundException('System setting not found');
    return setting;
  }

  async update(id: string, dto: UpdateSystemSettingDto, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id);
    const updated = await this.prisma.systemSetting.update({ where: { id }, data: dto });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'UPDATE', 'SystemSetting', id, {
      ...this.auditScope(ctx),
      ...identity,
      previous: { key: before.key, value: this.auditValue(before), status: before.status },
      next: { key: updated.key, value: this.auditValue(updated), status: updated.status },
      changedFields: Object.keys(dto),
    });
    return updated;
  }

  async findByGroup(group: string) {
    return this.prisma.systemSetting.findMany({ where: { group, status: 'ACTIVE' } });
  }

  async activate(id: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id);
    const updated = await this.prisma.systemSetting.update({ where: { id }, data: { status: 'ACTIVE' } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'ACTIVATE', 'SystemSetting', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'SYSTEM_SETTING_ACTIVATED',
      previous: { status: before.status },
      next: { status: updated.status },
    });
    return updated;
  }

  async deactivate(id: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id);
    const updated = await this.prisma.systemSetting.update({ where: { id }, data: { status: 'INACTIVE' } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'DEACTIVATE', 'SystemSetting', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'SYSTEM_SETTING_DEACTIVATED',
      previous: { status: before.status },
      next: { status: updated.status },
    });
    return updated;
  }

  private isSecretKey(key: string): boolean {
    const patterns = ['jwt', 'password', 'secret', 'token', 'credential', 'api_key', 'apiKey', 'apiSecret'];
    return patterns.some((p) => key.toLowerCase().includes(p.toLowerCase()));
  }

  private maskValue(): string {
    return '••••••••';
  }
}
