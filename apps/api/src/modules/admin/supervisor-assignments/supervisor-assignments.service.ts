import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateSupervisorAssignmentDto } from './dto/create-supervisor-assignment.dto';
import { UpdateSupervisorAssignmentDto } from './dto/update-supervisor-assignment.dto';
import { BulkSupervisorAssignmentDto } from './dto/bulk-supervisor-assignment.dto';
import { CandidateQueryDto } from './dto/candidate-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { Prisma } from '@prisma/client';

const MAX_HIERARCHY_DEPTH = 100;
const MAX_TOTAL_NODES = 10000;

type TxClient = Prisma.TransactionClient;

export type HierarchyTreeNode = {
  assignmentId: string;
  level: number;
  person: { id: string; name: string; code: string } | null;
  jobTitle: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  leadershipLevel: string;
  assignmentType: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  childCount: number;
  children: HierarchyTreeNode[];
};

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

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    const relationshipType = dto.relationshipType ?? 'DIRECT';

    if (relationshipType === 'DIRECT' && dto.supervisorAssignmentId) {
      return this.prisma.$transaction(async (tx) => {
        const assignment = await tx.operationalPersonAssignment.findFirst({
          where: { id: dto.assignmentId, companyId: ctx.companyId, deletedAt: null },
        });
        if (!assignment) throw this.validationError('assignmentId', 'validation.invalidReference', 'Assignment not found in current company');

        if (assignment.effectiveTo && effectiveTo && effectiveTo > assignment.effectiveTo) {
          throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond subordinate assignment effectiveTo');
        }
        if (assignment.effectiveTo && !effectiveTo) {
          throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when subordinate assignment has a finite effectiveTo');
        }

        const supervisorAssignment = await tx.operationalPersonAssignment.findFirst({
          where: { id: dto.supervisorAssignmentId!, companyId: ctx.companyId, deletedAt: null },
        });
        if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found in current company');

        if (supervisorAssignment.effectiveTo && effectiveTo && effectiveTo > supervisorAssignment.effectiveTo) {
          throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
        }
        if (supervisorAssignment.effectiveTo && !effectiveTo) {
          throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when supervisor assignment has a finite effectiveTo');
        }

        if (assignment.personnelId === supervisorAssignment.personnelId) {
          throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
        }

        assertBranchCompatible(assignment.branchId ?? null, supervisorAssignment.branchId ?? null);

        await this.assertNoOverlappingDirect(tx, dto.assignmentId, effectiveFrom, effectiveTo);

        const wouldCycle = await this.detectCycle(tx, dto.assignmentId, dto.supervisorAssignmentId!, effectiveFrom, effectiveTo);
        if (wouldCycle) {
          throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
        }

        const result = await tx.supervisorAssignment.create({
          data: {
            companyId: ctx.companyId,
            assignmentId: dto.assignmentId,
            supervisorAssignmentId: dto.supervisorAssignmentId ?? null,
            relationshipType,
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

        await this.auditService.logWithClient(tx, {
          userId: userId ?? 'system',
          action: 'CREATE',
          entity: 'SupervisorAssignment',
          entityId: result.id,
          details: JSON.stringify({
            assignmentId: dto.assignmentId,
            supervisorAssignmentId: dto.supervisorAssignmentId,
            relationshipType,
            companyId: ctx.companyId,
          }),
        });

        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    const assignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: dto.assignmentId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!assignment) throw this.validationError('assignmentId', 'validation.invalidReference', 'Assignment not found in current company');

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

      if (supervisorAssignment.effectiveTo && effectiveTo && effectiveTo > supervisorAssignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
      }
      if (supervisorAssignment.effectiveTo && !effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when supervisor assignment has a finite effectiveTo');
      }

      if (assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
      }

      assertBranchCompatible(assignment.branchId ?? null, supervisorAssignment.branchId ?? null);
    }

    const supervisorAssignment = await this.prisma.supervisorAssignment.create({
      data: {
        companyId: ctx.companyId,
        assignmentId: dto.assignmentId,
        supervisorAssignmentId: dto.supervisorAssignmentId ?? null,
        relationshipType,
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
        relationshipType,
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

    if (newEffectiveTo && newEffectiveTo < newEffectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    if (newSupervisorId && newSupervisorId !== existing.supervisorAssignmentId) {
      const supervisorAssignment = await this.prisma.operationalPersonAssignment.findFirst({
        where: { id: newSupervisorId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');

      if (supervisorAssignment.effectiveTo && newEffectiveTo && newEffectiveTo > supervisorAssignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
      }
      if (supervisorAssignment.effectiveTo && !newEffectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision (effectiveTo=null) is not allowed when supervisor assignment has a finite effectiveTo');
      }

      if (existing.assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
      }

      assertBranchCompatible(existing.assignment.branchId ?? null, supervisorAssignment.branchId ?? null);
    }

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

    const isDirectOperation = newType === 'DIRECT';
    const isSupervisorChange = newSupervisorId && newSupervisorId !== existing.supervisorAssignmentId;
    const isDateChange = newEffectiveTo !== existing.effectiveTo || newEffectiveFrom !== existing.effectiveFrom;
    const isTypeChangeToDirect = existing.relationshipType !== 'DIRECT' && newType === 'DIRECT';
    const needsAtomicTransaction = isDirectOperation && (isSupervisorChange || isDateChange || isTypeChangeToDirect);

    if (needsAtomicTransaction) {
      return this.prisma.$transaction(async (tx) => {
        if (isDirectOperation) {
          await this.assertNoOverlappingDirect(tx, existing.assignmentId, newEffectiveFrom, newEffectiveTo, id);
        }

        if (isDirectOperation && isSupervisorChange) {
          const wouldCycle = await this.detectCycle(tx, existing.assignmentId, newSupervisorId!, newEffectiveFrom, newEffectiveTo, id);
          if (wouldCycle) {
            throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
          }
        }

        if (isTypeChangeToDirect && newSupervisorId) {
          const existingDirectOverlap = await tx.supervisorAssignment.findFirst({
            where: {
              assignmentId: existing.assignmentId,
              relationshipType: 'DIRECT',
              isActive: true,
              deletedAt: null,
              NOT: { id },
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

        const sa = await tx.supervisorAssignment.update({
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

        await this.auditService.logWithClient(tx, {
          userId: userId ?? 'system',
          action: 'UPDATE',
          entity: 'SupervisorAssignment',
          entityId: id,
          details: JSON.stringify({ ...dto, companyId: ctx.companyId }),
        });

        return sa;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

  async getHierarchyTree(assignmentId: string, ctx: ActiveOperationalContext, asOf?: Date) {
    const now = asOf ?? new Date();

    const rootSa = await (this.prisma.supervisorAssignment.findFirst as any)({
      where: { assignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
            administration: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!rootSa) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }

    const reportingLineResult = await this.getReportingLine(assignmentId, ctx, asOf);

    type TreeNode = HierarchyTreeNode;

    const nodeMap = new Map<string, TreeNode>();
    const childrenMap = new Map<string, string[]>();

    const rootNode: TreeNode = {
      assignmentId,
      level: 0,
      person: rootSa.assignment.person,
      jobTitle: rootSa.assignment.jobTitle,
      department: rootSa.assignment.department,
      branch: rootSa.assignment.branch,
      administration: rootSa.assignment.administration,
      leadershipLevel: rootSa.assignment.leadershipLevel ?? 'NONE',
      assignmentType: rootSa.assignment.assignmentType,
      effectiveFrom: rootSa.effectiveFrom,
      effectiveTo: rootSa.effectiveTo,
      isActive: rootSa.isActive,
      childCount: 0,
      children: [],
    };
    nodeMap.set(assignmentId, rootNode);

    const queue: { id: string; depth: number }[] = [{ id: assignmentId, depth: 0 }];
    const visited = new Set<string>();
    let totalNodes = 0;
    let maxDepth = 0;

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
              branch: { select: { id: true, name: true, code: true } },
              administration: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      const childIds: string[] = [];
      for (const child of children) {
        if (!isEffectivelyActive(child, now)) continue;
        totalNodes++;
        if (totalNodes > 10000) break;

        const childDepth = currentDepth + 1;
        if (childDepth > maxDepth) maxDepth = childDepth;

        const childNode: TreeNode = {
          assignmentId: child.assignmentId,
          level: childDepth,
          person: child.assignment.person,
          jobTitle: child.assignment.jobTitle,
          department: child.assignment.department,
          branch: child.assignment.branch,
          administration: child.assignment.administration,
          leadershipLevel: child.assignment.leadershipLevel ?? 'NONE',
          assignmentType: child.assignment.assignmentType,
          effectiveFrom: child.effectiveFrom,
          effectiveTo: child.effectiveTo,
          isActive: child.isActive,
          childCount: 0,
          children: [],
        };
        nodeMap.set(child.assignmentId, childNode);
        childIds.push(child.assignmentId);
        queue.push({ id: child.assignmentId, depth: childDepth });
      }

      if (childIds.length > 0) {
        childrenMap.set(currentId, childIds);
        const parentNode = nodeMap.get(currentId);
        if (parentNode) parentNode.childCount = childIds.length;
      }

      if (totalNodes > 10000) break;
    }

    for (const [parentId, childIds] of childrenMap) {
      const parentNode = nodeMap.get(parentId);
      if (!parentNode) continue;
      parentNode.children = childIds.map(cid => nodeMap.get(cid)!).filter(Boolean);
    }

    return {
      root: rootNode,
      reportingLine: reportingLineResult.reportingLine,
      totalDescendants: totalNodes,
      maxDepth,
      truncated: totalNodes > 10000,
      asOf: now,
    };
  }

  /**
   * Assert no overlapping DIRECT supervisor relationship exists for this subordinate.
   * Uses half-open interval [effectiveFrom, effectiveTo) semantics.
   * Accepts either PrismaService or a transaction client for atomic operations.
   */
  private async assertNoOverlappingDirect(
    client: PrismaService | TxClient,
    assignmentId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const existingDirects = await (client as any).supervisorAssignment.findMany({
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
   * Accepts either PrismaService or a transaction client for atomic operations.
   *
   * Walks upward from the proposed supervisor's assignment, following only DIRECT relationships
   * that are effective during some portion of [candidateStart, candidateEnd).
   *
   * If the walk ever reaches the candidate subordinate assignment, a cycle would be created.
   */
  private async detectCycle(
    client: PrismaService | TxClient,
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
      } | null = await (client as any).supervisorAssignment.findFirst({
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

      if (!intervalsOverlap(sa.effectiveFrom, sa.effectiveTo, candidateStart, candidateEnd)) break;

      currentId = sa.supervisorAssignmentId;
      depth++;
    }

    return false;
  }

  async getCurrentTeam(supervisorAssignmentId: string, ctx: ActiveOperationalContext, asOf?: Date) {
    const now = asOf ?? new Date();

    const supervisor = await this.prisma.supervisorAssignment.findFirst({
      where: { id: supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!supervisor) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }

    const teamMembers = await this.prisma.supervisorAssignment.findMany({
      where: {
        supervisorAssignmentId,
        companyId: ctx.companyId,
        relationshipType: 'DIRECT',
        isActive: true,
        deletedAt: null,
      },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
            administration: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    const effectiveTeam = teamMembers.filter(m => isEffectivelyActive(m, now));

    return {
      supervisor: {
        id: supervisor.assignment.person.id,
        name: supervisor.assignment.person.name,
        code: supervisor.assignment.person.code,
        department: supervisor.assignment.department,
        jobTitle: supervisor.assignment.jobTitle,
        branch: supervisor.assignment.branch,
      },
      team: effectiveTeam.map(m => ({
        assignmentId: m.assignmentId,
        person: m.assignment.person,
        department: m.assignment.department,
        jobTitle: m.assignment.jobTitle,
        branch: m.assignment.branch,
        administration: m.assignment.administration,
        assignmentType: m.assignment.assignmentType,
        effectiveFrom: m.effectiveFrom,
        effectiveTo: m.effectiveTo,
        status: m.isActive ? 'ACTIVE' : 'INACTIVE',
      })),
      teamCount: effectiveTeam.length,
      asOf: now,
    };
  }

  async getCandidates(supervisorAssignmentId: string, query: CandidateQueryDto, ctx: ActiveOperationalContext) {
    const page = parseInt(query.page ?? '1', 10) || 1;
    const limit = Math.min(parseInt(query.limit ?? '10', 10) || 10, 50);
    const skip = (page - 1) * limit;

    const supervisorSa = await this.prisma.supervisorAssignment.findFirst({
      where: { id: supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!supervisorSa) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }

    const supervisorPersonId = supervisorSa.assignment.personnelId;
    const supervisorBranchId = supervisorSa.assignment.branchId;

    const where: any = { companyId: ctx.companyId, deletedAt: null };

    if (query.branchId) where.branchId = query.branchId;
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.jobTitleId) where.jobTitleId = query.jobTitleId;
    if (query.assignmentType) where.assignmentType = query.assignmentType;

    if (query.search) {
      where.OR = [
        { person: { name: { contains: query.search } } },
        { person: { code: { contains: query.search } } },
      ];
    }

    const [assignments, total] = await Promise.all([
      this.prisma.operationalPersonAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          person: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          jobTitle: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          administration: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.operationalPersonAssignment.count({ where }),
    ]);

    const candidateIds = assignments.map(a => a.id);
    const now = new Date();

    const [existingDirects, effectiveDirects] = await Promise.all([
      this.prisma.supervisorAssignment.findMany({
        where: {
          assignmentId: { in: candidateIds },
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, assignmentId: true, supervisorAssignmentId: true, effectiveFrom: true, effectiveTo: true, isActive: true, deletedAt: true },
      }),
      this.prisma.supervisorAssignment.findMany({
        where: {
          assignmentId: { in: candidateIds },
          supervisorAssignmentId,
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, assignmentId: true },
      }),
    ]);

    const hasDirectMap = new Map<string, boolean>();
    for (const id of candidateIds) { hasDirectMap.set(id, false); }
    for (const r of existingDirects) {
      if (isEffectivelyActive(r, now)) { hasDirectMap.set(r.assignmentId, true); }
    }

    const onThisTeamSet = new Set(effectiveDirects.map(r => r.assignmentId));

    const assignmentsWithEligibility = assignments.map(a => {
      if (a.personnelId === supervisorPersonId) {
        return { ...a, status: 'SELF', reasonCode: 'SELF', currentDirectSupervisor: null };
      }

      const subBranch = a.branchId;
      if (subBranch != null && supervisorBranchId != null && subBranch !== supervisorBranchId) {
        return { ...a, status: 'OUTSIDE_ALLOWED_BRANCH_SCOPE', reasonCode: 'OUTSIDE_ALLOWED_BRANCH_SCOPE', currentDirectSupervisor: null };
      }
      if (subBranch == null && supervisorBranchId != null) {
        return { ...a, status: 'OUTSIDE_ALLOWED_BRANCH_SCOPE', reasonCode: 'OUTSIDE_ALLOWED_BRANCH_SCOPE', currentDirectSupervisor: null };
      }

      if (onThisTeamSet.has(a.id)) {
        return { ...a, status: 'ALREADY_ON_THIS_TEAM', reasonCode: 'ALREADY_ON_THIS_TEAM', currentDirectSupervisor: { id: supervisorSa.id, person: supervisorSa.assignment.person } };
      }

      if (hasDirectMap.get(a.id)) {
        const otherDirect = existingDirects.find(r => r.assignmentId === a.id && isEffectivelyActive(r, now));
        return { ...a, status: 'HAS_OTHER_DIRECT_SUPERVISOR', reasonCode: 'HAS_OTHER_DIRECT_SUPERVISOR', currentDirectSupervisor: otherDirect ? { id: otherDirect.id } : null };
      }

      return { ...a, status: 'ELIGIBLE', reasonCode: 'ELIGIBLE', currentDirectSupervisor: null };
    });

    let filtered = assignmentsWithEligibility;
    if (query.withoutCurrentDirectSupervisor === 'true') {
      filtered = filtered.filter(a => hasDirectMap.get(a.id) === false);
    }

    return {
      data: filtered,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      supervisor: {
        assignmentId: supervisorAssignmentId,
        person: supervisorSa.assignment.person,
        branch: supervisorSa.assignment.branch,
      },
    };
  }

  private async validateBulkCandidate(
    assignment: { id: string; personnelId: string; branchId: string | null; effectiveFrom: Date; effectiveTo: Date | null },
    supervisorSa: { id: string; assignment: { personnelId: string; branchId: string | null } },
    relationshipType: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    companyId: string,
    client?: PrismaService | TxClient,
  ): Promise<{ status: string; reasonCode: string; currentSupervisor?: any }> {
    const c = client ?? this.prisma;

    if (assignment.personnelId === supervisorSa.assignment.personnelId) {
      return { status: 'SELF', reasonCode: 'SELF' };
    }

    try {
      assertBranchCompatible(assignment.branchId ?? null, supervisorSa.assignment.branchId ?? null);
    } catch {
      return { status: 'OUTSIDE_ALLOWED_BRANCH_SCOPE', reasonCode: 'OUTSIDE_ALLOWED_BRANCH_SCOPE' };
    }

    if (assignment.effectiveTo && effectiveTo && effectiveTo > assignment.effectiveTo) {
      return { status: 'DATE_WINDOW_CONFLICT', reasonCode: 'DATE_WINDOW_CONFLICT' };
    }
    if (assignment.effectiveTo && !effectiveTo) {
      return { status: 'DATE_WINDOW_CONFLICT', reasonCode: 'DATE_WINDOW_CONFLICT' };
    }

    const existingToSupervisor = await (c as any).supervisorAssignment.findFirst({
      where: {
        assignmentId: assignment.id,
        supervisorAssignmentId: supervisorSa.id,
        relationshipType: 'DIRECT',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true, isActive: true, deletedAt: true },
    });
    if (existingToSupervisor && isEffectivelyActive(existingToSupervisor, effectiveFrom)) {
      return { status: 'ALREADY_ON_THIS_TEAM', reasonCode: 'ALREADY_ON_THIS_TEAM', currentSupervisor: { id: existingToSupervisor.id } };
    }

    if (relationshipType === 'DIRECT') {
      const otherDirect = await (c as any).supervisorAssignment.findFirst({
        where: {
          assignmentId: assignment.id,
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, effectiveFrom: true, effectiveTo: true, isActive: true, deletedAt: true, supervisorAssignmentId: true },
      });
      if (otherDirect && isEffectivelyActive(otherDirect, effectiveFrom)) {
        return { status: 'HAS_OTHER_DIRECT_SUPERVISOR', reasonCode: 'HAS_OTHER_DIRECT_SUPERVISOR', currentSupervisor: { id: otherDirect.supervisorAssignmentId } };
      }

      const existingDirects = await (c as any).supervisorAssignment.findMany({
        where: {
          assignmentId: assignment.id,
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, effectiveFrom: true, effectiveTo: true },
      });
      for (const existing of existingDirects) {
        if (intervalsOverlap(existing.effectiveFrom, existing.effectiveTo, effectiveFrom, effectiveTo)) {
          return { status: 'DIRECT_OVERLAP', reasonCode: 'DIRECT_OVERLAP' };
        }
      }

      const wouldCycle = await this.detectCycle(c, assignment.id, supervisorSa.id, effectiveFrom, effectiveTo);
      if (wouldCycle) {
        return { status: 'CYCLE_DETECTED', reasonCode: 'CYCLE_DETECTED' };
      }
    }

    return { status: 'ELIGIBLE', reasonCode: 'ELIGIBLE' };
  }

  async bulkPreview(dto: BulkSupervisorAssignmentDto, ctx: ActiveOperationalContext) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    const relationshipType = dto.relationshipType ?? 'DIRECT';

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    const uniqueIds = new Set(dto.assignmentIds);
    if (uniqueIds.size !== dto.assignmentIds.length) {
      throw this.validationError('assignmentIds', 'validation.duplicateInput', 'Duplicate assignment IDs in request');
    }

    const supervisorSa = await this.prisma.supervisorAssignment.findFirst({
      where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!supervisorSa) {
      throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');
    }

    if (supervisorSa.assignment.effectiveTo && effectiveTo && effectiveTo > supervisorSa.assignment.effectiveTo) {
      throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
    }
    if (supervisorSa.assignment.effectiveTo && !effectiveTo) {
      throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision not allowed when supervisor assignment has finite effectiveTo');
    }

    const subordinateAssignments = await this.prisma.operationalPersonAssignment.findMany({
      where: { id: { in: dto.assignmentIds }, companyId: ctx.companyId, deletedAt: null },
      include: {
        person: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    const assignmentMap = new Map(subordinateAssignments.map(a => [a.id, a]));

    const summary = { requested: dto.assignmentIds.length, eligible: 0, alreadyAssigned: 0, conflicts: 0, invalid: 0 };
    const rows: any[] = [];

    for (const assignmentId of dto.assignmentIds) {
      const assignment = assignmentMap.get(assignmentId);

      if (!assignment) {
        summary.invalid++;
        rows.push({ assignmentId, status: 'MISSING', reasonCode: 'MISSING' });
        continue;
      }

      const validation = await this.validateBulkCandidate(assignment, supervisorSa, relationshipType, effectiveFrom, effectiveTo, ctx.companyId);

      if (validation.status === 'ELIGIBLE') {
        summary.eligible++;
      } else if (validation.status === 'ALREADY_ON_THIS_TEAM') {
        summary.alreadyAssigned++;
      } else {
        summary.conflicts++;
      }

      rows.push({
        assignmentId,
        person: assignment.person,
        department: assignment.department,
        jobTitle: assignment.jobTitle,
        branch: assignment.branch,
        assignmentType: assignment.assignmentType,
        ...validation,
      });
    }

    return { summary, rows };
  }

  async bulkApply(dto: BulkSupervisorAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    const relationshipType = dto.relationshipType ?? 'DIRECT';

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must not be before effectiveFrom');
    }

    const uniqueIds = new Set(dto.assignmentIds);
    if (uniqueIds.size !== dto.assignmentIds.length) {
      throw this.validationError('assignmentIds', 'validation.duplicateInput', 'Duplicate assignment IDs in request');
    }

    return this.prisma.$transaction(async (tx) => {
      const supervisorSa = await tx.supervisorAssignment.findFirst({
        where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
        include: {
          assignment: {
            include: {
              person: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!supervisorSa) {
        throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');
      }

      if (supervisorSa.assignment.effectiveTo && effectiveTo && effectiveTo > supervisorSa.assignment.effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Supervision effectiveTo must not extend beyond supervisor assignment effectiveTo');
      }
      if (supervisorSa.assignment.effectiveTo && !effectiveTo) {
        throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', 'Open-ended supervision not allowed when supervisor assignment has finite effectiveTo');
      }

      const subordinateAssignments = await tx.operationalPersonAssignment.findMany({
        where: { id: { in: dto.assignmentIds }, companyId: ctx.companyId, deletedAt: null },
      });

      const assignmentMap = new Map(subordinateAssignments.map(a => [a.id, a]));

      const errors: any[] = [];
      for (const assignmentId of dto.assignmentIds) {
        const assignment = assignmentMap.get(assignmentId);
        if (!assignment) {
          errors.push({ field: `assignmentIds[${assignmentId}]`, code: 'validation.invalidReference', message: 'Assignment not found in current company' });
          continue;
        }

        if (assignment.effectiveTo && effectiveTo && effectiveTo > assignment.effectiveTo) {
          errors.push({ field: `assignmentIds[${assignmentId}]`, code: 'validation.assignmentOutOfRange', message: 'Supervision effectiveTo extends beyond subordinate assignment effectiveTo' });
          continue;
        }
        if (assignment.effectiveTo && !effectiveTo) {
          errors.push({ field: `assignmentIds[${assignmentId}]`, code: 'validation.assignmentOutOfRange', message: 'Open-ended supervision not allowed when subordinate assignment has finite effectiveTo' });
          continue;
        }

        const validation = await this.validateBulkCandidate(assignment, supervisorSa, relationshipType, effectiveFrom, effectiveTo, ctx.companyId, tx);

        if (validation.status !== 'ELIGIBLE') {
          errors.push({ field: `assignmentIds[${assignmentId}]`, code: `validation.${validation.reasonCode.toLowerCase()}`, message: validation.status });
        }
      }

      if (errors.length > 0) {
        throw new BadRequestException({
          messageKey: 'common.validationFailed',
          message: 'Bulk validation failed',
          errors,
        });
      }

      const created: any[] = [];
      for (const assignmentId of dto.assignmentIds) {
        const result = await tx.supervisorAssignment.create({
          data: {
            companyId: ctx.companyId,
            assignmentId,
            supervisorAssignmentId: supervisorSa.assignmentId,
            relationshipType,
            effectiveFrom,
            effectiveTo,
          },
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

        await this.auditService.logWithClient(tx, {
          userId: userId ?? 'system',
          action: 'CREATE',
          entity: 'SupervisorAssignment',
          entityId: result.id,
          details: JSON.stringify({
            bulk: true,
            assignmentId,
            supervisorAssignmentId: supervisorSa.assignmentId,
            relationshipType,
            companyId: ctx.companyId,
          }),
        });

        created.push(result);
      }

      await this.auditService.logWithClient(tx, {
        userId: userId ?? 'system',
        action: 'BULK_CREATE',
        entity: 'SupervisorAssignment',
        details: JSON.stringify({
          bulkOperation: true,
          supervisorAssignmentId: supervisorSa.assignmentId,
          relationshipType,
          count: created.length,
          companyId: ctx.companyId,
        }),
      });

      return { created, count: created.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
