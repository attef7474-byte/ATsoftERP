import { Injectable, NotFoundException, BadRequestException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateAdministrationDto } from './dto/create-administration.dto';
import { UpdateAdministrationDto } from './dto/update-administration.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

type AuditActor = { id?: string; sub?: string; employeeId?: string | null };

@Injectable()
export class AdministrationsService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
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

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateAdministrationDto, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const branch = await this.prisma.branch.findFirst({ where: { id: ctx.branchId, companyId: ctx.companyId, deletedAt: null } });
    if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found');

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('ADMINISTRATION'));

    const existing = await this.prisma.administration.findFirst({
      where: { branchId: ctx.branchId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Administration code already exists');

    const { branchId: _branchId, ...rest } = dto;
    const created = await this.prisma.administration.create({ data: { ...rest, branchId: ctx.branchId, code } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'CREATE', 'Administration', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      next: { code: created.code, name: created.name, branchId: created.branchId, status: (created as any).status ?? null },
    });
    return created;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, branchId: ctx.branchId, branch: { companyId: ctx.companyId } };
    if (query.search) where.name = { contains: query.search };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.administration.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            include: { company: { select: { id: true, name: true, code: true } } },
          },
          _count: { select: { departments: true } },
        },
      }),
      this.prisma.administration.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const administration = await this.prisma.administration.findFirst({
      where: { id, branchId: ctx.branchId, branch: { companyId: ctx.companyId }, deletedAt: null },
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
        _count: { select: { departments: true } },
      },
    });
    if (!administration) {
      throw new NotFoundException({ messageKey: 'organization.administrationNotFound', message: 'Administration not found' });
    }
    return administration;
  }

  async update(id: string, dto: UpdateAdministrationDto, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const administration = await this.findOne(id, ctx);

    const code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.administration.findFirst({
        where: { branchId: ctx.branchId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Administration code already exists');
      dto = { ...dto, code };
    }

    const { branchId: _branchId, ...data } = dto;
    const updated = await this.prisma.administration.update({
      where: { id },
      data,
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'UPDATE', 'Administration', id, {
      ...this.auditScope(ctx),
      ...identity,
      previous: { code: administration.code, name: administration.name, status: (administration as any).status ?? null },
      next: { code: updated.code, name: updated.name, status: (updated as any).status ?? null },
      changedFields: Object.keys(data),
    });
    return updated;
  }

  async remove(id: string, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const before = await this.findOne(id, ctx);

    const deptCount = await this.prisma.department.count({ where: { administrationId: id, deletedAt: null } });
    if (deptCount > 0) {
      throw new ConflictException({
        messageKey: 'organization.cannotDeleteAdministrationWithDepartments',
        message: 'Cannot delete administration with active departments. Deactivate departments first.',
      });
    }

    const deletedAt = new Date();
    await this.prisma.administration.update({ where: { id }, data: { deletedAt } });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'DELETE', 'Administration', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'SOFT_DELETE',
      previous: { code: before.code, name: before.name, deletedAt: before.deletedAt ?? null },
      next: { deletedAt: deletedAt.toISOString() },
    });
    return { message: 'Administration deleted successfully' };
  }
}
