import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateSupervisorAssignmentDto } from './dto/create-supervisor-assignment.dto';
import { UpdateSupervisorAssignmentDto } from './dto/update-supervisor-assignment.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const MAX_HIERARCHY_DEPTH = 100;

/**
 * Half-open interval helper.
 * An effective interval is [effectiveFrom, effectiveTo).
 * NULL effectiveTo means unbounded (positive infinity).
 */
function intervalsOverlap(
  startA: Date, endA: Date | null,
  startB: Date, endB: Date | null,
): boolean {
  return startA < (endB ?? new Date('9999-12-31T23:59:59.999Z'))
    && startB < (endA ?? new Date('9999-12-31T23:59:59.999Z'));
}

/**
 * Returns true if the supervisor assignment record is effective at the given timestamp.
 * Requires: deletedAt IS NULL, isActive = true, effectiveFrom <= asOf, effectiveTo IS NULL OR effectiveTo > asOf.
 */
function isEffectivelyActive(
  record: { deletedAt: Date | null; isActive: boolean; effectiveFrom: Date; effectiveTo: Date | null },
  asOf: Date,
): boolean {
  if (record.deletedAt !== null) return false;
  if (!record.isActive) return false;
  if (record.effectiveFrom > asOf) return false;
  if (record.effectiveTo !== null && record.effectiveTo <= asOf) return false;
  return true;
}

/**
 * HIER-A Branch Compatibility Policy:
 *
 * CASE 1: subordinate.branchId != null, supervisor.branchId == same → ALLOW
 * CASE 2: subordinate.branchId != null, supervisor.branchId == null  → ALLOW
 * CASE 3: subordinate.branchId != null, supervisor.branchId != null, differ → REJECT
 * CASE 4: subordinate.branchId == null, supervisor.branchId == null          → ALLOW
 * CASE 5: subordinate.branchId == null, supervisor.branchId != null          → REJECT
 */
function assertBranchCompatible(
  subordinateBranchId: string | null,
  supervisorBranchId: string | null,
): void {
  if (subordinateBranchId != null && supervisorBranchId != null && subordinateBranchId !== supervisorBranchId) {
    throw new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field: 'supervisorAssignmentId', code: 'validation.invalidBranchHierarchy', message: 'Supervisor and subordinate must belong to the same branch when both have a branch assigned' }],
    });
  }
  if (subordinateBranchId == null && supervisorBranchId != null) {
    throw new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field: 'supervisorAssignmentId', code: 'validation.invalidBranchHierarchy', message: 'A branch-specific supervisor cannot supervise a company-wide assignment' }],
    });
  }
}

@Injectable()
export class SupervisorAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateSupervisorAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    // 1. Validate subordinate assignment
    const assignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: dto.assignmentId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!assignment) throw this.validationError('assignmentId', 'validation.invalidReference', 'Assignment not found in current company');

    // Validate effectiveTo >= effectiveFrom
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    // Validate relationship does not outlive subordinate assignment
    if (assignment.effectiveTo && effectiveTo && effectiveTo > assignment.effectiveTo) {
      throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond subordinate assignment effectiveTo');
    }
    if (assignment.effectiveTo && !effectiveTo) {
      throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when subordinate assignment has a finite effectiveTo');
    }

    if (dto.supervisorAssignmentId) {
      const supervisorAssignment = await this.prisma.operationalPersonAssignment.findFirst({
        where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found in current company');

      // Validate supervisor assignment not deleted and belongs to same company
      // (already enforced by companyId filter above)

      // Validate relationship does not outlive supervisor assignment
      if (supervisorAssignment.effectiveTo && effectiveTo && effectiveTo > supervisorAssignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
      }
      if (supervisorAssignment.effectiveTo && !effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when supervisor assignment has a finite effectiveTo');
      }

      // 2. Self-supervision (personnelId-level)
      if (assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
      }

      // 3. Branch compatibility
      assertBranchCompatible(assignment.branchId ?? null, supervisorAssignment.branchId ?? null);

      const relationshipType = dto.relationshipType ?? 'DIRECT';

      // 4. One effective DIRECT supervisor rule + DIRECT interval overlap
      if (relationshipType === 'DIRECT') {
        await this.assertNoOverlappingDirect(dto.assignmentId, effectiveFrom, effectiveTo);
      }

      // 5. Temporal cycle detection (DIRECT-only)
      if (relationshipType === 'DIRECT') {
        const wouldCycle = await this.detectCycle(dto.assignmentId, dto.supervisorAssignmentId, effectiveFrom, effectiveTo);
        if (wouldCycle) {
          throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
        }
      }
    }

    const supervisorAssignment = await this.prisma.supervisorAssignment.create({
      data: {
        companyId: ctx.companyId,
        assignmentId: dto.assignmentId,
        supervisorAssignmentId: dto.supervisorAssignmentId ?? null,
        relationshipType: dto.relationshipType ?? 'DIRECT',
        effectiveFrom,
        effectiveTo,
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
        supervisorAssignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'CREATE',
      entity: 'SupervisorAssignment',
      entityId: supervisorAssignment.id,
      details: JSON.stringify({
        assignmentId: dto.assignmentId,
        supervisorAssignmentId: dto.supervisorAssignmentId,
        relationshipType: dto.relationshipType ?? 'DIRECT',
        companyId: ctx.companyId,
      }),
    });

    return supervisorAssignment;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; assignmentId?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.assignmentId) where.assignmentId = query.assignmentId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      where.OR = [
        { assignment: { person: { name: { contains: query.search } } } },
        { supervisorAssignment: { person: { name: { contains: query.search } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supervisorAssignment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          assignment: {
            include: {
              person: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
            },
          },
          supervisorAssignment: {
            include: {
              person: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.supervisorAssignment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const sa = await this.prisma.supervisorAssignment.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, code: true } },
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
          },
        },
        supervisorAssignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!sa) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }
    return sa;
  }

  async update(id: string, dto: UpdateSupervisorAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);

    const newSupervisorId = dto.supervisorAssignmentId !== undefined ? dto.supervisorAssignmentId : existing.supervisorAssignmentId;
    const newType = dto.relationshipType !== undefined ? dto.relationshipType : existing.relationshipType;
    const newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const newEffectiveTo = dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : existing.effectiveTo;

    // Validate effectiveTo >= effectiveFrom
    if (newEffectiveTo && newEffectiveTo < newEffectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    if (newSupervisorId && newSupervisorId !== existing.supervisorAssignmentId) {
      const supervisorAssignment = await this.prisma.operationalPersonAssignment.findFirst({
        where: { id: newSupervisorId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');

      // Validate relationship does not outlive supervisor assignment
      if (supervisorAssignment.effectiveTo && newEffectiveTo && newEffectiveTo > supervisorAssignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
      }
      if (supervisorAssignment.effectiveTo && !newEffectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when supervisor assignment has a finite effectiveTo');
      }

      // Self-supervision (personnelId-level)
      if (existing.assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
      }

      // Branch compatibility
      assertBranchCompatible(existing.assignment.branchId ?? null, supervisorAssignment.branchId ?? null);
    }

    // Validate subordinate assignment date window
    if (newEffectiveTo !== existing.effectiveTo || newEffectiveFrom !== existing.effectiveFrom) {
      const assignment = await this.prisma.operationalPersonAssignment.findFirst({
        where: { id: existing.assignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (assignment?.effectiveTo && newEffectiveTo && newEffectiveTo > assignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond subordinate assignment effectiveTo');
      }
      if (assignment?.effectiveTo && !newEffectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when subordinate assignment has a finite effectiveTo');
      }
    }

    // One effective DIRECT supervisor + DIRECT interval overlap (only when relationship is or becomes DIRECT)
    if (newType === 'DIRECT') {
      await this.assertNoOverlappingDirect(existing.assignmentId, newEffectiveFrom, newEffectiveTo, id);
    }

    // Temporal cycle detection (DIRECT-only)
    if (newType === 'DIRECT' && newSupervisorId && newSupervisorId !== existing.supervisorAssignmentId) {
      const wouldCycle = await this.detectCycle(existing.assignmentId, newSupervisorId, newEffectiveFrom, newEffectiveTo, id);
      if (wouldCycle) {
        throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
      }
    }

    // Prevent changing MATRIX → overlapping DIRECT
    if (existing.relationshipType !== 'DIRECT' && newType === 'DIRECT' && newSupervisorId) {
      const existingDirectOverlap = await this.prisma.supervisorAssignment.findFirst({
        where: {
          assignmentId: existing.assignmentId,
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
          NOT: { id: id },
        },
      });
      if (existingDirectOverlap && isEffectivelyActive(existingDirectOverlap, newEffectiveFrom)) {
        throw this.validationError('relationshipType', 'validation.directSupervisorOverlap', 'Cannot change to DIRECT: an overlapping DIRECT relationship already exists');
      }
    }

    const data: any = {};
    if (dto.supervisorAssignmentId !== undefined) data.supervisorAssignmentId = dto.supervisorAssignmentId ?? null;
    if (dto.relationshipType !== undefined) data.relationshipType = dto.relationshipType;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = new Date(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    const sa = await this.prisma.supervisorAssignment.update({
      where: { id },
      data,
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
        supervisorAssignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'UPDATE',
      entity: 'SupervisorAssignment',
      entityId: id,
      details: JSON.stringify({ ...dto, companyId: ctx.companyId }),
    });

    return sa;
  }

  async remove(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const sa = await this.findOne(id, ctx);

    await this.prisma.supervisorAssignment.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'REMOVE',
      entity: 'SupervisorAssignment',
      entityId: id,
      details: JSON.stringify({ assignmentId: sa.assignmentId, supervisorAssignmentId: sa.supervisorAssignmentId, companyId: ctx.companyId }),
    });

    return { message: 'Supervisor assignment removed successfully' };
  }

  async getReportingLine(assignmentId: string, ctx: ActiveOperationalContext, asOf?: Date) {
    const now = asOf ?? new Date();
    const line: any[] = [];
    let currentAssignmentId: string | null = assignmentId;
    const visited = new Set<string>();
    let depth = 0;

    while (currentAssignmentId && depth < MAX_HIERARCHY_DEPTH) {
      if (visited.has(currentAssignmentId)) break;
      visited.add(currentAssignmentId);

      const sa: {
        id: string;
        supervisorAssignmentId: string | null;
        relationshipType: string;
        effectiveFrom: Date;
        effectiveTo: Date | null;
        isActive: boolean;
        deletedAt: Date | null;
        supervisorAssignment: {
          id: string;
          personnelId: string;
          person: { id: string; name: string; code: string } | null;
          department: { id: string; name: string; code: string } | null;
          jobTitle: { id: string; name: string; code: string } | null;
        } | null;
      } | null = await (this.prisma.supervisorAssignment.findFirst as any)({
        where: {
          assignmentId: currentAssignmentId,
          companyId: ctx.companyId,
          isActive: true,
          deletedAt: null,
          relationshipType: 'DIRECT',
        },
        select: {
          id: true,
          supervisorAssignmentId: true,
          relationshipType: true,
          effectiveFrom: true,
          effectiveTo: true,
          isActive: true,
          deletedAt: true,
          supervisorAssignment: {
            select: {
              id: true,
              personnelId: true,
              person: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
              jobTitle: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!sa || !sa.supervisorAssignment) break;

      // Date-aware filtering: only include relationships effective at `now`
      if (!isEffectivelyActive(sa, now)) break;

      line.push({
        level: depth + 1,
        supervisor: sa.supervisorAssignment.person,
        department: sa.supervisorAssignment.department,
        jobTitle: sa.supervisorAssignment.jobTitle,
        relationshipType: sa.relationshipType,
      });

      currentAssignmentId = sa.supervisorAssignmentId;
      depth++;
    }

    return { assignmentId, reportingLine: line, depth: line.length };
  }

  async getSubordinates(assignmentId: string, ctx: ActiveOperationalContext, asOf?: Date) {
    const now = asOf ?? new Date();
    const subordinates: any[] = [];
    const queue: { id: string; depth: number }[] = [{ id: assignmentId, depth: 0 }];
    const visited = new Set<string>();
    let totalNodes = 0;
    const MAX_TOTAL_NODES = 10000;

    while (queue.length > 0) {
      const { id: currentId, depth: currentDepth } = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentDepth >= MAX_HIERARCHY_DEPTH) continue;

      const children = await (this.prisma.supervisorAssignment.findMany as any)({
        where: {
          supervisorAssignmentId: currentId,
          companyId: ctx.companyId,
          isActive: true,
          deletedAt: null,
          relationshipType: 'DIRECT',
        },
        include: {
          assignment: {
            include: {
              person: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
              jobTitle: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      for (const child of children) {
        if (!isEffectivelyActive(child, now)) continue;
        totalNodes++;
        if (totalNodes > MAX_TOTAL_NODES) break;

        const childDepth = currentDepth + 1;
        subordinates.push({
          level: childDepth,
          assignment: child.assignment,
          relationshipType: child.relationshipType,
        });
        queue.push({ id: child.assignmentId, depth: childDepth });
      }

      if (totalNodes > MAX_TOTAL_NODES) break;
    }

    return { assignmentId, subordinates, count: subordinates.length };
  }

  /**
   * Assert no overlapping DIRECT supervisor relationship exists for this subordinate.
   * Uses half-open interval [effectiveFrom, effectiveTo) semantics.
   */
  private async assertNoOverlappingDirect(
    assignmentId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const existingDirects = await this.prisma.supervisorAssignment.findMany({
      where: {
        assignmentId,
        relationshipType: 'DIRECT',
        isActive: true,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
        supervisorAssignmentId: true,
      },
    });

    for (const existing of existingDirects) {
      if (intervalsOverlap(existing.effectiveFrom, existing.effectiveTo, effectiveFrom, effectiveTo)) {
        throw this.validationError('assignmentId', 'validation.directSupervisorOverlap', 'A DIRECT supervisor relationship effective during the requested interval already exists for this subordinate');
      }
    }
  }

  /**
   * Temporal cycle detection for DIRECT relationships.
   *
   * Walks upward from the proposed supervisor's assignment, following only DIRECT relationships
   * that are effective during some portion of [candidateStart, candidateEnd).
   *
   * If the walk ever reaches the candidate subordinate assignment, a cycle would be created.
   *
   * Algorithm:
   * 1. Start at the proposed supervisor's assignment.
   * 2. Find the DIRECT relationship FROM that assignment (i.e., who supervises the supervisor?).
   * 3. If that relationship is effective during any overlap with the candidate interval,
   *    follow it upward.
   * 4. If we reach the candidate subordinate, a cycle exists.
   * 5. Use visited-set for safety, depth limit for termination.
   */
  private async detectCycle(
    subordinateAssignmentId: string,
    proposedSupervisorAssignmentId: string,
    candidateStart: Date,
    candidateEnd: Date | null,
    excludeId?: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = proposedSupervisorAssignmentId;
    let depth = 0;

    while (currentId && depth < MAX_HIERARCHY_DEPTH) {
      if (currentId === subordinateAssignmentId) return true;
      if (visited.has(currentId)) return true;
      visited.add(currentId);

      const sa: {
        supervisorAssignmentId: string | null;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      } | null = await (this.prisma.supervisorAssignment.findFirst as any)({
        where: {
          assignmentId: currentId,
          isActive: true,
          deletedAt: null,
          relationshipType: 'DIRECT',
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: {
          supervisorAssignmentId: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });

      if (!sa || !sa.supervisorAssignmentId) break;

      // Only follow the link if the existing relationship is effective during
      // some portion of the candidate's interval (temporal cycle check)
      if (!intervalsOverlap(sa.effectiveFrom, sa.effectiveTo, candidateStart, candidateEnd)) break;

      currentId = sa.supervisorAssignmentId;
      depth++;
    }

    return false;
  }
}
