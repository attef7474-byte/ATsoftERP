import { Injectable, NotFoundException } from '@nestjs/common';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { currentAssignmentWindow } from '../../../../common/operational-context/current-assignment-window';
import { PrismaService } from '../../../../common/prisma/prisma.service';

export interface CanonicalTechnician {
  id: string;
  userId: string;
  maintenancePersonnelId: string;
  operationalPersonId: string;
  code: string;
  name: string;
  role: string;
  specialty: string | null;
  placement: string | null;
}

/**
 * Single canonical bridge between an authenticated User and active
 * MaintenancePersonnel. The chain is always:
 *
 *   User -> OperationalPerson -> current OperationalPersonAssignment -> MaintenancePersonnel
 *
 * No legacy work-order assignedToId, broad user list, or independently created
 * personnel record is accepted as authority.
 */
@Injectable()
export class MaintenanceTechnicianAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(ctx: ActiveOperationalContext) {
    if (!ctx?.companyId || !ctx.branchId) {
      throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
    }
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  private currentAssignment(ctx: ActiveOperationalContext) {
    return { ...this.scope(ctx), deletedAt: null, ...currentAssignmentWindow() };
  }

  private userWhere(ctx: ActiveOperationalContext, search?: string) {
    const where: any = {
      status: 'ACTIVE',
      deletedAt: null,
      AND: [
        { OR: [{ companyId: ctx.companyId }, { companyId: null }] },
        { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
      ],
      operationalPeople: {
        some: {
          isActive: true,
          maintenancePersonnel: { isActive: true },
          assignments: { some: this.currentAssignment(ctx) },
        },
      },
    };
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { operationalPeople: { some: { code: { contains: term } } } },
        { operationalPeople: { some: { name: { contains: term } } } },
        { operationalPeople: { some: { maintenancePersonnel: { role: { contains: term } } } } },
        { operationalPeople: { some: { maintenancePersonnel: { specialty: { contains: term } } } } },
      ];
    }
    return where;
  }

  private personInclude(ctx: ActiveOperationalContext) {
    return {
      operationalPeople: {
        where: {
          isActive: true,
          maintenancePersonnel: { isActive: true },
          assignments: { some: this.currentAssignment(ctx) },
        },
        select: {
          id: true,
          code: true,
          name: true,
          maintenancePersonnel: {
            select: { id: true, role: true, specialty: true, isActive: true },
          },
          assignments: {
            where: this.currentAssignment(ctx),
            select: {
              department: { select: { name: true } },
              jobTitle: { select: { name: true } },
              branch: { select: { name: true } },
            },
            orderBy: { effectiveFrom: 'desc' as const },
            take: 1,
          },
        },
      },
    };
  }

  private flatten(userId: string, person: any): CanonicalTechnician | null {
    const mp = person?.maintenancePersonnel;
    if (!person || !mp?.isActive) return null;
    const assignment = person.assignments?.[0];
    const placement = assignment
      ? [assignment.department?.name, assignment.jobTitle?.name, assignment.branch?.name].filter(Boolean).join(' / ')
      : null;
    return {
      id: mp.id,
      userId,
      maintenancePersonnelId: mp.id,
      operationalPersonId: person.id,
      code: person.code,
      name: person.name,
      role: mp.role,
      specialty: mp.specialty ?? null,
      placement,
    };
  }

  async candidates(
    query: { page?: number; limit?: number; search?: string },
    ctx: ActiveOperationalContext,
    client: any = this.prisma,
  ) {
    this.scope(ctx);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where = this.userWhere(ctx, query.search);
    const [users, total] = await Promise.all([
      client.user.findMany({
        where,
        select: { id: true, ...this.personInclude(ctx) },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      client.user.count({ where }),
    ]);
    const seen = new Set<string>();
    const data: CanonicalTechnician[] = [];
    for (const user of users) {
      for (const person of (user as any).operationalPeople || []) {
        const technician = this.flatten(user.id, person);
        if (technician && !seen.has(technician.maintenancePersonnelId)) {
          seen.add(technician.maintenancePersonnelId);
          data.push(technician);
        }
      }
    }
    return { data: data.slice(0, limit), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async candidate(
    maintenancePersonnelId: string,
    ctx: ActiveOperationalContext,
    client: any = this.prisma,
  ): Promise<CanonicalTechnician> {
    const technician = await this.byPersonnel(maintenancePersonnelId, ctx, client);
    if (!technician) throw new NotFoundException({ messageKey: 'maintenance.personnelNotFound' });
    return technician;
  }

  /** Returns null instead of throwing so callers can use it for authorization checks. */
  async byUser(userId: string, ctx: ActiveOperationalContext, client: any = this.prisma): Promise<CanonicalTechnician | null> {
    if (!userId) return null;
    this.scope(ctx);
    const user = await client.user.findFirst({ where: { id: userId, ...this.userWhere(ctx) }, select: { id: true, ...this.personInclude(ctx) } });
    if (!user) return null;
    const matches = ((user as any).operationalPeople || [])
      .map((person: any) => this.flatten(user.id, person))
      .filter(Boolean) as CanonicalTechnician[];
    if (matches.length !== 1) return null;
    return matches[0];
  }

  async byPersonnel(maintenancePersonnelId: string, ctx: ActiveOperationalContext, client: any = this.prisma): Promise<CanonicalTechnician | null> {
    if (!maintenancePersonnelId) return null;
    this.scope(ctx);
    const assignment = this.currentAssignment(ctx);
    const records = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        AND: [
          { OR: [{ companyId: ctx.companyId }, { companyId: null }] },
          { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
        ],
        operationalPeople: {
          some: {
            isActive: true,
            maintenancePersonnel: { id: maintenancePersonnelId, isActive: true },
            assignments: { some: assignment },
          },
        },
      },
      select: { id: true, ...this.personInclude(ctx) },
      take: 5,
    });
    const matches: CanonicalTechnician[] = [];
    for (const user of records) {
      for (const person of (user as any).operationalPeople || []) {
        const technician = this.flatten(user.id, person);
        if (technician?.maintenancePersonnelId === maintenancePersonnelId) matches.push(technician);
      }
    }
    return matches.length === 1 ? matches[0] : null;
  }
}
