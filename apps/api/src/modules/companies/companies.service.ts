import { Injectable, NotFoundException, ConflictException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

type AuditActor = { id?: string; sub?: string; employeeId?: string | null };

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    // Modules/controllers are outside this task's ownership. Optional injection
    // keeps the app startable today and uses the shared singleton once the
    // module imports AuditModule.
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

  async create(dto: CreateCompanyDto, ctx: ActiveOperationalContext, actor?: AuditActor) {
    this.assertSystemAdministration(ctx);
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('COMPANY');
    const existing = await this.prisma.company.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Company code already exists');
    const created = await this.prisma.company.create({ data: { ...dto, code } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'CREATE', 'Company', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      next: { code: created.code, name: created.name, status: (created as any).status ?? null },
    });
    return created;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (ctx.source !== 'SUPER_ADMIN') where.id = ctx.companyId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { branches: true, departments: true, users: true, warehouses: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    if (ctx.source !== 'SUPER_ADMIN' && id !== ctx.companyId) {
      throw new NotFoundException('Company not found');
    }
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { branches: true, departments: true, users: true, warehouses: true, machines: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, ctx: ActiveOperationalContext, actor?: AuditActor) {
    this.assertSystemAdministration(ctx);
    const before = await this.findOne(id, ctx);
    const updated = await this.prisma.company.update({ where: { id }, data: dto });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'UPDATE', 'Company', id, {
      ...this.auditScope(ctx),
      ...identity,
      previous: { code: before.code, name: before.name, status: (before as any).status ?? null },
      next: { code: updated.code, name: updated.name, status: (updated as any).status ?? null },
      changedFields: Object.keys(dto),
    });
    return updated;
  }

  async remove(id: string, ctx: ActiveOperationalContext, actor?: AuditActor) {
    this.assertSystemAdministration(ctx);
    const before = await this.findOne(id, ctx);
    const deletedAt = new Date();
    await this.prisma.company.update({ where: { id }, data: { deletedAt } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'DELETE', 'Company', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'SOFT_DELETE',
      previous: { deletedAt: before.deletedAt ?? null, code: before.code, name: before.name },
      next: { deletedAt: deletedAt.toISOString() },
    });
    return { message: 'Company deleted successfully' };
  }

  private assertSystemAdministration(ctx: ActiveOperationalContext) {
    if (ctx.source !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ messageKey: 'organization.systemAdministrationRequired' });
    }
  }
}
