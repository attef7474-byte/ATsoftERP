import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceContextService } from '../context/performance-context.service';

@Injectable()
export class PerformanceCoverageService {
  constructor(private prisma: PrismaService, private contextService: PerformanceContextService) {}

  private currentWindow(now = new Date()) {
    return { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
  }

  async summary(ctx: ActiveOperationalContext) {
    const now = new Date();
    const window = this.currentWindow(now);
    const basePersonWhere: any = { isActive: true, assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } } };
    const activeEmployees = await this.prisma.operationalPerson.count({ where: basePersonWhere });

    const withCurrentAssignmentIds = await this.prisma.operationalPersonAssignment.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE', ...window, person: { isActive: true } },
      select: { personnelId: true },
      distinct: ['personnelId'],
    });
    const withCurrentAssignment = withCurrentAssignmentIds.length;
    const withoutCurrentAssignment = Math.max(0, activeEmployees - withCurrentAssignment);

    const currentAssignments = await this.prisma.operationalPersonAssignment.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE', ...window, person: { isActive: true } },
      select: { personnelId: true, jobTitleId: true, id: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    // pick deterministic current per person
    const byPerson = new Map<string, { jobTitleId: string | null; assignmentId: string }>();
    for (const a of currentAssignments) {
      if (!byPerson.has(a.personnelId)) byPerson.set(a.personnelId, { jobTitleId: a.jobTitleId ?? null, assignmentId: a.id });
    }
    const currentPersonIds = [...byPerson.keys()];
    const withJobTitle = currentPersonIds.filter((id) => !!byPerson.get(id)?.jobTitleId).length;
    const withoutJobTitle = currentPersonIds.length - withJobTitle;

    // supervisor: has active supervisor assignment for current assignment
    let withSupervisor = 0;
    for (const pid of currentPersonIds) {
      const a = byPerson.get(pid)!;
      const sup = await this.prisma.supervisorAssignment.count({ where: { companyId: ctx.companyId, assignmentId: a.assignmentId, deletedAt: null, isActive: true, status: 'ACTIVE', ...window } });
      if (sup > 0) withSupervisor++;
    }
    const withoutSupervisor = currentPersonIds.length - withSupervisor;

    // profile resolution - compute per current person (bounded by page in UI; for summary we compute but keep it simple)
    let withProfile = 0;
    for (const pid of currentPersonIds) {
      try {
        const ctxResolved = await this.contextService.resolve(pid, ctx, now);
        if (ctxResolved.performanceProfile) withProfile++;
      } catch { /* ignore missing */ }
    }
    const withoutProfile = currentPersonIds.length - withProfile;

    return {
      activeEmployees,
      withCurrentAssignment,
      withoutCurrentAssignment,
      withJobTitle,
      withoutJobTitle,
      withSupervisor,
      withoutSupervisor,
      withPerformanceProfile: withProfile,
      withoutPerformanceProfile: withoutProfile,
    };
  }

  async employees(query: { page?: number; limit?: number; search?: string; departmentId?: string; jobTitleId?: string; performanceProfileId?: string; hasProfile?: string; hasJobTitle?: string; hasSupervisor?: string }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const now = new Date();
    const window = this.currentWindow(now);

    const where: any = { isActive: true, assignments: { some: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } } };
    if (query.search) where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }];

    const persons = await this.prisma.operationalPerson.findMany({
      where, orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, category: true, isActive: true },
    });

    const rows: any[] = [];
    for (const p of persons) {
      let resolved: any = null;
      try { resolved = await this.contextService.resolve(p.id, ctx, now); } catch { resolved = null; }
      const hasCurrent = !!resolved;
      const hasJobTitle = !!resolved?.organization?.jobTitle;
      const hasSupervisor = !!resolved?.supervisor;
      const hasProfile = !!resolved?.performanceProfile;
      const profileId = resolved?.performanceProfile?.id ?? null;
      const deptId = resolved?.organization?.department?.id ?? null;
      const jtId = resolved?.organization?.jobTitle?.id ?? null;

      if (query.departmentId && deptId !== query.departmentId) continue;
      if (query.jobTitleId && jtId !== query.jobTitleId) continue;
      if (query.performanceProfileId && profileId !== query.performanceProfileId) continue;
      if (query.hasProfile === 'true' && !hasProfile) continue;
      if (query.hasProfile === 'false' && hasProfile) continue;
      if (query.hasJobTitle === 'true' && !hasJobTitle) continue;
      if (query.hasJobTitle === 'false' && hasJobTitle) continue;
      if (query.hasSupervisor === 'true' && !hasSupervisor) continue;
      if (query.hasSupervisor === 'false' && hasSupervisor) continue;

      rows.push({
        employee: { id: p.id, code: p.code, name: p.name, category: p.category },
        hasCurrentAssignment: hasCurrent,
        department: resolved?.organization?.department ?? null,
        jobTitle: resolved?.organization?.jobTitle ?? null,
        supervisor: resolved?.supervisor ?? null,
        performanceProfile: resolved?.performanceProfile ? { id: resolved.performanceProfile.id, code: resolved.performanceProfile.code, name: resolved.performanceProfile.name, nameAr: resolved.performanceProfile.nameAr, nameEn: resolved.performanceProfile.nameEn } : null,
      });
    }

    const total = rows.length;
    const paged = rows.slice((page - 1) * limit, (page - 1) * limit + limit);
    return { data: paged, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
