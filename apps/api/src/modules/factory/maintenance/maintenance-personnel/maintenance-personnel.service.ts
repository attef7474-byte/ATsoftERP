import { AuditService } from '../../../audit/audit.service';
import { normalizeIdentity, assertIdentityAvailable, lockIdentityCompany } from '../../../../common/validation/person-identity';
import { currentAssignmentWindow } from '../../../../common/operational-context/current-assignment-window';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { PersonRegistrationsService } from '../../../admin/person-registrations/person-registrations.service';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMaintenancePersonnelDto, UpdateMaintenancePersonnelDto } from './dto/create-maintenance-personnel.dto';

@Injectable()
export class MaintenancePersonnelService {
  constructor(private prisma: PrismaService, private registrations: PersonRegistrationsService, private audit: AuditService) {}

  private scope(ctx: ActiveOperationalContext) {
    return { operationalPerson: { assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, ...currentAssignmentWindow() } } } };
  }

  async create(dto: CreateMaintenancePersonnelDto, ctx: ActiveOperationalContext, actorId?: string) {
    dto = normalizeIdentity(dto);
    // Legacy route delegates to registration, including its permission gates and audit.
    const result = await this.registrations.create({
      code: dto.code, name: dto.name, phone: dto.phone, email: dto.email, notes: dto.notes,
      isActive: dto.isActive, category: 'MAINTENANCE',
      placement: { departmentId: dto.departmentId },
      maintenance: { role: dto.role, specialty: dto.specialty, isActive: dto.isActive },
      ...(dto.userId ? { login: { userId: dto.userId } } : {}),
    }, ctx, actorId);
    return this.findOne(result.maintenanceCapability!.id, ctx);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; role?: string; specialty?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 10));
    const where: any = this.scope(ctx);
    if (query.search) {
      where.operationalPerson = {
        ...where.operationalPerson,
        OR: [
          { code: { contains: query.search } },
          { name: { contains: query.search } },
          { email: { contains: query.search } },
          { phone: { contains: query.search } },
        ],
      };
    }
    if (query.role) where.role = query.role;
    if (query.specialty) where.specialty = query.specialty;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.maintenancePersonnel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      this.prisma.maintenancePersonnel.count({ where }),
    ]);
    return { data: data.map(r => this.mapPersonnel(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const record = await this.prisma.maintenancePersonnel.findFirst({
      where: { id, ...this.scope(ctx) },
      include: {
        operationalPerson: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        machineResponsibilities: { where: { machine: { companyId: ctx.companyId, branchId: ctx.branchId } }, include: { machine: { select: { id: true, code: true, name: true } } } },
        requestAssignments: { where: { maintenanceRequest: { machine: { companyId: ctx.companyId, branchId: ctx.branchId } } }, include: { maintenanceRequest: { select: { id: true, requestNumber: true, title: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Maintenance personnel not found');
    return this.mapPersonnel(record);
  }

  async update(id: string, dto: UpdateMaintenancePersonnelDto, ctx: ActiveOperationalContext, actorId?: string) {
    const existing = await this.prisma.maintenancePersonnel.findFirst({
      where: { id, ...this.scope(ctx) },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    if (dto.code && dto.code !== existing.operationalPerson.code) {
      throw new BadRequestException('Code cannot be changed after creation');
    }
    const { code, ...restDto } = normalizeIdentity(dto);

    if (restDto.userId !== undefined && restDto.userId !== existing.operationalPerson.userId) {
      if (restDto.userId) {
        const user = await this.prisma.user.findFirst({ where: { id: restDto.userId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        if (!user) throw new BadRequestException('User not found');
        const conflict = await this.prisma.operationalPerson.findFirst({ where: { userId: restDto.userId, id: { not: existing.operationalPersonId } } });
        if (conflict) throw new ConflictException('User is already linked to another operational person');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await lockIdentityCompany(tx, ctx);
      await assertIdentityAvailable(tx, 'operationalPerson', restDto, ctx, existing.operationalPersonId);
      await tx.operationalPerson.update({
        where: { id: existing.operationalPersonId },
        data: {
          ...(restDto.name !== undefined ? { name: restDto.name } : {}),
          ...(restDto.phone !== undefined ? { phone: restDto.phone } : {}),
          ...(restDto.email !== undefined ? { email: restDto.email } : {}),
          ...(restDto.notes !== undefined ? { notes: restDto.notes } : {}),
          ...(restDto.userId !== undefined ? { userId: restDto.userId } : {}),
          ...(restDto.isActive !== undefined ? { isActive: restDto.isActive } : {}),
        },
      });

      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: {
          ...(restDto.role !== undefined ? { role: restDto.role } : {}),
          ...(restDto.specialty !== undefined ? { specialty: restDto.specialty } : {}),
          ...(restDto.isActive !== undefined ? { isActive: restDto.isActive } : {}),
        },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      await this.audit.logWithClient(tx, { userId: actorId, action: 'UPDATE', entity: 'MaintenancePersonnel', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, previousValues: this.mapPersonnel(existing), newValues: this.mapPersonnel(updated) } });
      return this.mapPersonnel(updated);
    });
  }

  async activate(id: string, ctx: ActiveOperationalContext, actorId?: string) {
    const existing = await this.prisma.maintenancePersonnel.findFirst({
      where: { id, ...this.scope(ctx) },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: true } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: true },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      await this.audit.logWithClient(tx, { userId: actorId, action: 'UPDATE', entity: 'MaintenancePersonnel', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, previousValues: this.mapPersonnel(existing), newValues: this.mapPersonnel(updated) } });
      return this.mapPersonnel(updated);
    });
  }

  async deactivate(id: string, ctx: ActiveOperationalContext, actorId?: string) {
    const existing = await this.prisma.maintenancePersonnel.findFirst({
      where: { id, ...this.scope(ctx) },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: false } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: false },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      await this.audit.logWithClient(tx, { userId: actorId, action: 'UPDATE', entity: 'MaintenancePersonnel', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, previousValues: this.mapPersonnel(existing), newValues: this.mapPersonnel(updated) } });
      return this.mapPersonnel(updated);
    });
  }

  async remove(id: string, ctx: ActiveOperationalContext, actorId?: string) {
    const existing = await this.prisma.maintenancePersonnel.findFirst({
      where: { id, ...this.scope(ctx) },
      include: { operationalPerson: true, _count: { select: { machineResponsibilities: true, requestAssignments: true } } },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');
    if (existing._count.machineResponsibilities > 0) {
      throw new ConflictException('Cannot deactivate personnel with linked machine responsibilities');
    }
    if (existing._count.requestAssignments > 0) {
      throw new ConflictException('Cannot deactivate personnel with linked request assignments');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: false } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: false },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      await this.audit.logWithClient(tx, { userId: actorId, action: 'UPDATE', entity: 'MaintenancePersonnel', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, previousValues: this.mapPersonnel(existing), newValues: this.mapPersonnel(updated) } });
      return this.mapPersonnel(updated);
    });
  }

  private mapPersonnel(r: any) {
    return {
      id: r.id,
      role: r.role,
      specialty: r.specialty,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      operationalPersonId: r.operationalPersonId,
      code: r.operationalPerson?.code ?? null,
      name: r.operationalPerson?.name ?? null,
      phone: r.operationalPerson?.phone ?? null,
      email: r.operationalPerson?.email ?? null,
      notes: r.operationalPerson?.notes ?? null,
      userId: r.operationalPerson?.userId ?? null,
      user: r.operationalPerson?.user ?? null,
      machineResponsibilities: r.machineResponsibilities,
      requestAssignments: r.requestAssignments,
    };
  }
}
