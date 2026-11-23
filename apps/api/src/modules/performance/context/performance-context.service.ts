import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

type ResolvedProfile = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  category: string;
  isActive: boolean;
  source: { targetType: string; mappingId: string; effectiveFrom: Date; effectiveTo: Date | null; priority: number };
} | null;

@Injectable()
export class PerformanceContextService {
  constructor(private prisma: PrismaService) {}

  private effectiveWindow(effectiveAt: Date) {
    return { effectiveFrom: { lte: effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }] };
  }

  private pickCurrentAssignment<T extends { assignmentType: string; effectiveFrom: Date }>(assignments: T[]): T | null {
    if (!assignments.length) return null;
    const rank: Record<string, number> = { PRIMARY: 0, ACTING: 1, SECONDARY: 2, TEMPORARY: 3 };
    return [...assignments].sort((a, b) => {
      const ra = rank[a.assignmentType] ?? 9;
      const rb = rank[b.assignmentType] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    })[0];
  }

  private async resolveProfile(companyId: string, effectiveAt: Date, jobTitleId: string | null, maintenanceRole: string | null, operationalCategory: string | null): Promise<ResolvedProfile> {
    const window = this.effectiveWindow(effectiveAt);
    const baseWhere: any = { companyId, deletedAt: null, isActive: true, status: 'ACTIVE', ...window, performanceProfile: { deletedAt: null } };
    const pick = async (where: any) => {
      const mapping = await this.prisma.performanceProfileMapping.findFirst({
        where: { ...baseWhere, ...where },
        orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }],
        include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, category: true, isActive: true } } },
      });
      if (!mapping || !mapping.performanceProfile) return null;
      // Historical context may resolve a profile that is currently inactive if it was valid at effectiveAt.
      // Current/new resolution must not resolve an inactive profile.
      const profileIsInactive = !mapping.performanceProfile.isActive;
      const now = new Date();
      if (profileIsInactive && effectiveAt >= now) return null;
      return {
        id: mapping.performanceProfile.id,
        code: mapping.performanceProfile.code,
        name: mapping.performanceProfile.name,
        nameAr: mapping.performanceProfile.nameAr,
        nameEn: mapping.performanceProfile.nameEn,
        category: mapping.performanceProfile.category,
        isActive: mapping.performanceProfile.isActive,
        source: { targetType: mapping.targetType, mappingId: mapping.id, effectiveFrom: mapping.effectiveFrom, effectiveTo: mapping.effectiveTo, priority: mapping.priority },
      };
    };

    if (jobTitleId) {
      const byJob = await pick({ targetType: 'JOB_TITLE', jobTitleId });
      if (byJob) return byJob;
    }
    if (maintenanceRole) {
      const byRole = await pick({ targetType: 'MAINTENANCE_ROLE', targetCode: maintenanceRole.toUpperCase() });
      if (byRole) return byRole;
    }
    if (operationalCategory) {
      const byCat = await pick({ targetType: 'OPERATIONAL_CATEGORY', targetCode: operationalCategory.toUpperCase() });
      if (byCat) return byCat;
    }
    return null;
  }

  async resolve(operationalPersonId: string, ctx: ActiveOperationalContext, effectiveAtInput?: string | Date) {
    const effectiveAt = effectiveAtInput ? new Date(effectiveAtInput) : new Date();
    if (Number.isNaN(effectiveAt.getTime())) throw new NotFoundException({ messageKey: 'validation.invalidDate', message: 'Invalid effectiveAt' });

    const person = await this.prisma.operationalPerson.findFirst({
      where: { id: operationalPersonId },
      select: { id: true, code: true, name: true, category: true, isActive: true },
    });
    if (!person) throw new NotFoundException({ messageKey: 'employees.notFound', message: 'Employee not found' });

    const window = this.effectiveWindow(effectiveAt);
    const assignments = await this.prisma.operationalPersonAssignment.findMany({
      where: { personnelId: operationalPersonId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE', ...window },
      include: {
        department: { select: { id: true, code: true, name: true } },
        jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } },
        branch: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, code: true, name: true } },
        supervisorAssignments: {
          where: { deletedAt: null, isActive: true, status: 'ACTIVE', ...window },
          include: {
            supervisorAssignment: {
              include: { person: { select: { id: true, code: true, name: true } } },
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const currentAssignment = this.pickCurrentAssignment(assignments);
    // tenant isolation: if person exists but no assignment in this company/branch context, do not leak - return not found in context
    if (!currentAssignment) {
      throw new NotFoundException({ messageKey: 'performance.contextNotFound', message: 'Employee performance context not found in active context' });
    }

    const supervisorLink = currentAssignment.supervisorAssignments?.[0];
    const supervisorPerson = supervisorLink?.supervisorAssignment?.person ?? null;

    const maintenancePersonnel = await this.prisma.maintenancePersonnel.findFirst({
      where: { operationalPersonId, isActive: true },
      select: { id: true, role: true, specialty: true, isActive: true },
    });

    const responsibilities = maintenancePersonnel ? await this.prisma.machineResponsibilityAssignment.findMany({
      where: { maintenancePersonnelId: maintenancePersonnel.id, status: 'ACTIVE', startDate: { lte: effectiveAt }, OR: [{ endDate: null }, { endDate: { gt: effectiveAt } }] },
      include: { machine: { select: { id: true, code: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
    }) : [];

    const productionAssignment = await this.prisma.productionShiftAssignment.findFirst({
      where: { operationalPersonId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE', effectiveFrom: { lte: effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }] },
      include: { shift: { select: { id: true, code: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { effectiveFrom: 'desc' }],
    });

    const profile = await this.resolveProfile(ctx.companyId, effectiveAt, currentAssignment.jobTitleId ?? null, maintenancePersonnel?.role ?? null, person.category ?? null);

    return {
      employee: { id: person.id, code: person.code, name: person.name, category: person.category, isActive: person.isActive },
      effectiveAt: effectiveAt.toISOString(),
      organization: {
        company: currentAssignment.company ? { id: currentAssignment.company.id, code: currentAssignment.company.code, name: currentAssignment.company.name } : null,
        branch: currentAssignment.branch ? { id: currentAssignment.branch.id, code: currentAssignment.branch.code, name: currentAssignment.branch.name } : null,
        department: currentAssignment.department ? { id: currentAssignment.department.id, code: currentAssignment.department.code, name: currentAssignment.department.name } : null,
        jobTitle: currentAssignment.jobTitle ? { id: currentAssignment.jobTitle.id, code: currentAssignment.jobTitle.code, name: currentAssignment.jobTitle.name, nameAr: currentAssignment.jobTitle.nameAr, nameEn: currentAssignment.jobTitle.nameEn } : null,
        assignment: { id: currentAssignment.id, assignmentType: currentAssignment.assignmentType, leadershipLevel: currentAssignment.leadershipLevel, effectiveFrom: currentAssignment.effectiveFrom, effectiveTo: currentAssignment.effectiveTo },
      },
      supervisor: supervisorPerson ? { id: supervisorPerson.id, code: supervisorPerson.code, name: supervisorPerson.name } : null,
      performanceProfile: profile,
      maintenance: maintenancePersonnel ? {
        id: maintenancePersonnel.id,
        role: maintenancePersonnel.role,
        specialty: maintenancePersonnel.specialty,
        isActive: maintenancePersonnel.isActive,
        machineResponsibilities: responsibilities.map((r) => ({ id: r.id, scopeType: r.scopeType, isPrimary: r.isPrimary, responsibilityRole: r.responsibilityRole, startDate: r.startDate, endDate: r.endDate, status: r.status, machine: r.machine ? { id: r.machine.id, code: r.machine.code, name: r.machine.name } : null })),
      } : null,
      production: productionAssignment ? {
        id: productionAssignment.id,
        code: productionAssignment.code,
        isPrimary: productionAssignment.isPrimary,
        effectiveFrom: productionAssignment.effectiveFrom,
        effectiveTo: productionAssignment.effectiveTo,
        shift: productionAssignment.shift ? { id: productionAssignment.shift.id, code: productionAssignment.shift.code, name: productionAssignment.shift.name } : null,
      } : null,
    };
  }
}
