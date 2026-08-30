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

export type DirectIntegrityInput = {
  companyId: string;
  assignmentId: string;
  supervisorAssignmentId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  excludeRelationshipId?: string;
  excludeRelationshipIds?: string[];
  assignmentSnapshot?: DirectIntegrityAssignmentSnapshot;
  supervisorAssignmentSnapshot?: DirectIntegrityAssignmentSnapshot;
  plannedDirectRelationships?: DirectIntegrityRelationshipSnapshot[];
};

export type DirectIntegrityAssignmentSnapshot = {
  id: string;
  personnelId: string;
  branchId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type DirectIntegrityRelationshipSnapshot = {
  id?: string;
  assignmentId: string;
  supervisorAssignmentId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

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
export function intervalsOverlap(
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
export function isEffectivelyActive(
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
export function assertBranchCompatible(
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
    const validRelationshipTypes = ['DIRECT', 'MATRIX', 'FUNCTIONAL'];
    if (!validRelationshipTypes.includes(relationshipType)) {
      throw this.validationError('relationshipType', 'validation.invalidValue', `Invalid relationship type: ${relationshipType}`);
    }

    if (relationshipType === 'DIRECT') {
      return this.prisma.$transaction(async (tx) => {
        await this.assertDirectIntegrityWithClient(tx, {
          companyId: ctx.companyId,
          assignmentId: dto.assignmentId,
          supervisorAssignmentId: dto.supervisorAssignmentId ?? null,
          effectiveFrom,
          effectiveTo,
        });

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

    const where: any = {
      deletedAt: null,
      companyId: ctx.companyId,
      assignment: { is: { branchId: { in: [ctx.branchId, null] } } },
    };
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
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
        assignment: { is: { branchId: { in: [ctx.branchId, null] as any } } },
      },
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

    const validRelationshipTypes = ['DIRECT', 'MATRIX', 'FUNCTIONAL'];
    if (!validRelationshipTypes.includes(newType)) {
      throw this.validationError('relationshipType', 'validation.invalidValue', `Invalid relationship type: ${newType}`);
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
          await this.assertNoOverlappingDirect(tx, ctx.companyId, existing.assignmentId, newEffectiveFrom, newEffectiveTo, [id]);
        }

        if (isDirectOperation && isSupervisorChange) {
          const wouldCycle = await this.detectCycle(tx, ctx.companyId, existing.assignmentId, newSupervisorId!, newEffectiveFrom, newEffectiveTo, [id]);
          if (wouldCycle) {
            throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
          }
        }

        if (isTypeChangeToDirect && newSupervisorId) {
          const existingDirectOverlap = await tx.supervisorAssignment.findFirst({
            where: {
              companyId: ctx.companyId,
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

    const rootOpa = await (this.prisma.operationalPersonAssignment.findFirst as any)({
      where: { id: assignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        person: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
      },
    });

    if (!rootOpa) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }

    if (rootOpa.deletedAt !== null || rootOpa.effectiveFrom > now || (rootOpa.effectiveTo !== null && rootOpa.effectiveTo <= now)) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not effective at the requested date' });
    }

    const reportingLineResult = await this.getReportingLine(assignmentId, ctx, asOf);

    type TreeNode = HierarchyTreeNode;

    const nodeMap = new Map<string, TreeNode>();
    const childrenMap = new Map<string, string[]>();

    const rootNode: TreeNode = {
      assignmentId,
      level: 0,
      person: rootOpa.person,
      jobTitle: rootOpa.jobTitle,
      department: rootOpa.department,
      branch: rootOpa.branch,
      administration: rootOpa.administration,
      leadershipLevel: rootOpa.leadershipLevel ?? 'NONE',
      assignmentType: rootOpa.assignmentType,
      effectiveFrom: rootOpa.effectiveFrom,
      effectiveTo: rootOpa.effectiveTo,
      isActive: true,
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
    companyId: string,
    assignmentId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeRelationshipIds: string[] = [],
    plannedDirectRelationships: DirectIntegrityRelationshipSnapshot[] = [],
  ): Promise<void> {
    const existingDirects = await (client as any).supervisorAssignment.findMany({
      where: {
        companyId,
        assignmentId,
        relationshipType: 'DIRECT',
        isActive: true,
        deletedAt: null,
        ...(excludeRelationshipIds.length > 0 ? { NOT: { id: { in: excludeRelationshipIds } } } : {}),
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
        supervisorAssignmentId: true,
      },
    }) ?? [];

    const plannedForAssignment = plannedDirectRelationships.filter((relationship) =>
      relationship.assignmentId === assignmentId,
    );
    for (const existing of [...existingDirects, ...plannedForAssignment]) {
      if (intervalsOverlap(existing.effectiveFrom, existing.effectiveTo, effectiveFrom, effectiveTo)) {
        throw this.validationError('assignmentId', 'validation.directSupervisorOverlap', 'A DIRECT supervisor relationship effective during the requested interval already exists for this subordinate');
      }
    }
  }

  /**
   * Canonical HIER-A DIRECT-integrity policy for callers that already own a
   * Serializable Prisma transaction. Keeping this policy here prevents transfer
   * workflows from growing a weaker, parallel hierarchy implementation.
   */
  async assertDirectIntegrityWithClient(
    client: PrismaService | TxClient,
    input: DirectIntegrityInput,
  ): Promise<void> {
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    }
    const assignment = input.assignmentSnapshot ?? await (client as any).operationalPersonAssignment.findFirst({
      where: { id: input.assignmentId, companyId: input.companyId, deletedAt: null },
    });
    if (!assignment) {
      throw this.validationError('assignmentId', 'validation.invalidReference', 'Assignment not found in current company');
    }

    this.assertRelationshipWithinAssignmentWindow(
      assignment,
      input.effectiveFrom,
      input.effectiveTo,
      'assignmentId',
      'subordinate',
    );

    const excludedRelationshipIds = Array.from(new Set([
      ...(input.excludeRelationshipIds ?? []),
      ...(input.excludeRelationshipId ? [input.excludeRelationshipId] : []),
    ]));
    await this.assertNoOverlappingDirect(
      client,
      input.companyId,
      input.assignmentId,
      input.effectiveFrom,
      input.effectiveTo,
      excludedRelationshipIds,
      input.plannedDirectRelationships,
    );

    if (!input.supervisorAssignmentId) return;

    const supervisorAssignment = input.supervisorAssignmentSnapshot ?? await (client as any).operationalPersonAssignment.findFirst({
      where: { id: input.supervisorAssignmentId, companyId: input.companyId, deletedAt: null },
    });
    if (!supervisorAssignment) {
      throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found in current company');
    }
    this.assertRelationshipWithinAssignmentWindow(
      supervisorAssignment,
      input.effectiveFrom,
      input.effectiveTo,
      'supervisorAssignmentId',
      'supervisor',
    );
    if (assignment.personnelId === supervisorAssignment.personnelId) {
      throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
    }
    assertBranchCompatible(assignment.branchId ?? null, supervisorAssignment.branchId ?? null);

    const wouldCycle = await this.detectCycle(
      client,
      input.companyId,
      input.assignmentId,
      input.supervisorAssignmentId,
      input.effectiveFrom,
      input.effectiveTo,
      excludedRelationshipIds,
      input.plannedDirectRelationships,
    );
    if (wouldCycle) {
      throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
    }
  }

  private assertRelationshipWithinAssignmentWindow(
    assignment: { effectiveFrom: Date; effectiveTo: Date | null },
    effectiveFrom: Date,
    effectiveTo: Date | null,
    field: string,
    label: string,
  ): void {
    if (effectiveFrom < assignment.effectiveFrom) {
      throw this.validationError(field, 'validation.assignmentOutOfRange', `Supervision cannot start before the ${label} assignment`);
    }
    if (assignment.effectiveTo && effectiveFrom >= assignment.effectiveTo) {
      throw this.validationError(field, 'validation.assignmentOutOfRange', `Supervision must start before the ${label} assignment ends`);
    }
    if (assignment.effectiveTo && (!effectiveTo || effectiveTo > assignment.effectiveTo)) {
      throw this.validationError('effectiveTo', 'validation.assignmentOutOfRange', `Supervision must not extend beyond the ${label} assignment`);
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
    companyId: string,
    subordinateAssignmentId: string,
    proposedSupervisorAssignmentId: string,
    candidateStart: Date,
    candidateEnd: Date | null,
    excludeRelationshipIds: string[] = [],
    plannedDirectRelationships: DirectIntegrityRelationshipSnapshot[] = [],
  ): Promise<boolean> {
    type TraversalState = {
      assignmentId: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      depth: number;
      path: string[];
    };
    const queue: TraversalState[] = [{
      assignmentId: proposedSupervisorAssignmentId,
      effectiveFrom: candidateStart,
      effectiveTo: candidateEnd,
      depth: 0,
      path: [proposedSupervisorAssignmentId],
    }];
    const visitedStates = new Set<string>();
    let exploredStates = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.assignmentId === subordinateAssignmentId) return true;

      const stateKey = `${current.assignmentId}|${current.effectiveFrom.toISOString()}|${current.effectiveTo?.toISOString() ?? 'OPEN'}`;
      if (visitedStates.has(stateKey)) continue;
      visitedStates.add(stateKey);
      exploredStates++;
      if (exploredStates > MAX_TOTAL_NODES) return true;

      const persistedRelationships: DirectIntegrityRelationshipSnapshot[] = await (client as any).supervisorAssignment.findMany({
        where: {
          companyId,
          assignmentId: current.assignmentId,
          isActive: true,
          deletedAt: null,
          relationshipType: 'DIRECT',
          ...(current.effectiveTo ? { effectiveFrom: { lt: current.effectiveTo } } : {}),
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: current.effectiveFrom } },
          ],
          ...(excludeRelationshipIds.length > 0 ? { NOT: { id: { in: excludeRelationshipIds } } } : {}),
        },
        select: {
          id: true,
          assignmentId: true,
          supervisorAssignmentId: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      }) ?? [];
      const plannedRelationships = plannedDirectRelationships.filter((relationship) =>
        relationship.assignmentId === current.assignmentId
        && intervalsOverlap(relationship.effectiveFrom, relationship.effectiveTo, current.effectiveFrom, current.effectiveTo),
      );
      const relationships = [...persistedRelationships, ...plannedRelationships];
      if (current.depth >= MAX_HIERARCHY_DEPTH && relationships.length > 0) return true;

      for (const relationship of relationships) {
        if (!relationship.supervisorAssignmentId) continue;
        const nextEffectiveFrom = relationship.effectiveFrom > current.effectiveFrom
          ? relationship.effectiveFrom
          : current.effectiveFrom;
        const nextEffectiveTo = !current.effectiveTo
          ? relationship.effectiveTo
          : !relationship.effectiveTo
            ? current.effectiveTo
            : relationship.effectiveTo < current.effectiveTo
              ? relationship.effectiveTo
              : current.effectiveTo;
        if (nextEffectiveTo && nextEffectiveFrom >= nextEffectiveTo) continue;
        if (relationship.supervisorAssignmentId === subordinateAssignmentId) return true;
        if (current.path.includes(relationship.supervisorAssignmentId)) return true;
        queue.push({
          assignmentId: relationship.supervisorAssignmentId,
          effectiveFrom: nextEffectiveFrom,
          effectiveTo: nextEffectiveTo,
          depth: current.depth + 1,
          path: [...current.path, relationship.supervisorAssignmentId],
        });
      }
    }

    return false;
  }

  async getCurrentTeam(supervisorAssignmentId: string, ctx: ActiveOperationalContext, asOf?: Date) {
    const now = asOf ?? new Date();

    const supervisor = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        person: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
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
        id: supervisor.person.id,
        name: supervisor.person.name,
        code: supervisor.person.code,
        department: supervisor.department,
        jobTitle: supervisor.jobTitle,
        branch: supervisor.branch,
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

    const supervisorSa = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        person: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!supervisorSa) {
      throw new NotFoundException({ messageKey: 'organization.supervisorAssignmentNotFound', message: 'Supervisor assignment not found' });
    }

    const supervisorPersonId = supervisorSa.personnelId;
    const supervisorBranchId = supervisorSa.branchId;

    const where: any = { companyId: ctx.companyId, deletedAt: null, branchId: query.branchId ?? ctx.branchId };

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
        return { ...a, status: 'ALREADY_ON_THIS_TEAM', reasonCode: 'ALREADY_ON_THIS_TEAM', currentDirectSupervisor: { id: supervisorSa.id, person: supervisorSa.person } };
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
        person: supervisorSa.person,
        branch: supervisorSa.branch,
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
        companyId,
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
          companyId,
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
          companyId,
          assignmentId: assignment.id,
          relationshipType: 'DIRECT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, effectiveFrom: true, effectiveTo: true },
      }) ?? [];
      for (const existing of existingDirects) {
        if (intervalsOverlap(existing.effectiveFrom, existing.effectiveTo, effectiveFrom, effectiveTo)) {
          return { status: 'DIRECT_OVERLAP', reasonCode: 'DIRECT_OVERLAP' };
        }
      }

      const wouldCycle = await this.detectCycle(c, companyId, assignment.id, supervisorSa.id, effectiveFrom, effectiveTo);
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

    const supervisorOpa = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      include: {
        person: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!supervisorOpa) {
      throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');
    }

    const supervisorSa = { id: supervisorOpa.id, assignment: supervisorOpa };

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
      const supervisorOpa = await tx.operationalPersonAssignment.findFirst({
        where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
        include: {
          person: { select: { id: true, name: true, code: true } },
        },
      });

      if (!supervisorOpa) {
        throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');
      }

      const supervisorSa = { id: supervisorOpa.id, assignment: supervisorOpa };

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
            supervisorAssignmentId: supervisorSa.id,
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
            supervisorAssignmentId: supervisorSa.id,
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
          supervisorAssignmentId: supervisorSa.id,
          relationshipType,
          count: created.length,
          companyId: ctx.companyId,
        }),
      });

      return { created, count: created.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private deriveTemporalStatus(
    effectiveFrom: Date,
    effectiveTo: Date | null,
    isActive: boolean,
  ): string {
    const now = new Date();
    if (effectiveFrom > now) return 'FUTURE';
    if (!isActive) return 'PAST';
    if (effectiveTo !== null && effectiveTo <= now) return 'PAST';
    return 'CURRENT';
  }

  async getSupervisionHistory(
    query: {
      personId?: string;
      assignmentId?: string;
      supervisorAssignmentId?: string;
      relationshipType?: string;
      branchId?: string;
      administrationId?: string;
      departmentId?: string;
      from?: string;
      to?: string;
      status?: string;
      page?: number;
      limit?: number;
      sort?: string;
    },
    ctx: ActiveOperationalContext,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: ctx.companyId,
      deletedAt: null,
    };

    if (query.relationshipType) {
      where.relationshipType = query.relationshipType;
    }

    if (query.assignmentId) {
      where.assignmentId = query.assignmentId;
    }

    if (query.supervisorAssignmentId) {
      where.supervisorAssignmentId = query.supervisorAssignmentId;
    }

    // Person filter: must match either subordinate or supervisor personnelId
    if (query.personId) {
      where.OR = [
        { assignment: { personnelId: query.personId } },
        { supervisorAssignment: { personnelId: query.personId } },
      ];
    }

    // Branch/admin/department filters on subordinate side
    if (query.branchId) {
      where.assignment = { ...where.assignment, branchId: query.branchId };
    }
    if (query.administrationId) {
      where.assignment = { ...where.assignment, administrationId: query.administrationId };
    }
    if (query.departmentId) {
      where.assignment = { ...where.assignment, departmentId: query.departmentId };
    }

    // Temporal status filter
    const now = new Date();
    if (query.status === 'CURRENT') {
      where.isActive = true;
      where.effectiveFrom = { lte: now };
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gt: now } },
      ];
    } else if (query.status === 'PAST') {
      where.OR = [
        { effectiveTo: { lte: now } },
        { isActive: false },
      ];
    } else if (query.status === 'FUTURE') {
      where.effectiveFrom = { gt: now };
    }

    // Date range overlap filter: record overlaps [from, to)
    if (query.from || query.to) {
      const rangeStart = query.from ? new Date(query.from) : new Date('1900-01-01');
      const rangeEnd = query.to ? new Date(query.to) : new Date('9999-12-31T23:59:59.999Z');
      // Overlap: recordStart < rangeEnd AND rangeStart < recordEnd
      // recordEnd = effectiveTo ?? infinity
      const temporalConditions = [
        { effectiveFrom: { lt: rangeEnd } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: rangeStart } }] },
      ];
      if (where.AND) {
        where.AND.push(...temporalConditions);
      } else {
        where.AND = temporalConditions;
      }
    }

    const orderBy = query.sort === 'effectiveFrom_asc'
      ? { effectiveFrom: 'asc' as const }
      : { effectiveFrom: 'desc' as const };

    const include = {
      assignment: {
        include: {
          person: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          jobTitle: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          administration: { select: { id: true, name: true, code: true } },
        },
      },
      supervisorAssignment: {
        include: {
          person: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          jobTitle: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          administration: { select: { id: true, name: true, code: true } },
        },
      },
    };

    const [rows, total] = await Promise.all([
      (this.prisma.supervisorAssignment.findMany as any)({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      (this.prisma.supervisorAssignment.count as any)({ where }),
    ]);

    const data = rows.map((row: any) => {
      const temporalStatus = this.deriveTemporalStatus(row.effectiveFrom, row.effectiveTo, row.isActive);
      return {
        id: row.id,
        relationshipType: row.relationshipType,
        subordinate: {
          assignmentId: row.assignmentId,
          person: row.assignment?.person,
          jobTitle: row.assignment?.jobTitle,
          department: row.assignment?.department,
          branch: row.assignment?.branch,
          administration: row.assignment?.administration,
          assignmentType: row.assignment?.assignmentType,
        },
        supervisor: row.supervisorAssignment ? {
          assignmentId: row.supervisorAssignmentId,
          person: row.supervisorAssignment?.person,
          jobTitle: row.supervisorAssignment?.jobTitle,
          department: row.supervisorAssignment?.department,
          branch: row.supervisorAssignment?.branch,
          administration: row.supervisorAssignment?.administration,
          assignmentType: row.supervisorAssignment?.assignmentType,
        } : null,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        isActive: row.isActive,
        status: row.status,
        temporalStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLeadershipHistory(
    query: {
      personId?: string;
      assignmentId?: string;
      leadershipLevel?: string;
      assignmentType?: string;
      branchId?: string;
      administrationId?: string;
      departmentId?: string;
      from?: string;
      to?: string;
      status?: string;
      page?: number;
      limit?: number;
      sort?: string;
    },
    ctx: ActiveOperationalContext,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: ctx.companyId,
      deletedAt: null,
      leadershipLevel: { not: 'NONE' },
    };

    if (query.personId) {
      where.personnelId = query.personId;
    }

    if (query.assignmentId) {
      where.id = query.assignmentId;
    }

    if (query.leadershipLevel) {
      where.leadershipLevel = query.leadershipLevel;
    }

    if (query.assignmentType) {
      where.assignmentType = query.assignmentType;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.administrationId) {
      where.administrationId = query.administrationId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    // Temporal status filter
    const now = new Date();
    if (query.status === 'CURRENT') {
      where.effectiveFrom = { lte: now };
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gt: now } },
      ];
    } else if (query.status === 'PAST') {
      where.OR = [
        { effectiveTo: { lte: now } },
        { status: 'INACTIVE' },
      ];
    } else if (query.status === 'FUTURE') {
      where.effectiveFrom = { gt: now };
    }

    // Date range overlap filter
    if (query.from || query.to) {
      const rangeStart = query.from ? new Date(query.from) : new Date('1900-01-01');
      const rangeEnd = query.to ? new Date(query.to) : new Date('9999-12-31T23:59:59.999Z');
      const temporalConditions = [
        { effectiveFrom: { lt: rangeEnd } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: rangeStart } }] },
      ];
      if (where.AND) {
        where.AND.push(...temporalConditions);
      } else {
        where.AND = temporalConditions;
      }
    }

    const orderBy = query.sort === 'effectiveFrom_asc'
      ? { effectiveFrom: 'asc' as const }
      : { effectiveFrom: 'desc' as const };

    const include = {
      person: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
      jobTitle: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
      administration: { select: { id: true, name: true, code: true } },
    };

    const [rows, total] = await Promise.all([
      (this.prisma.operationalPersonAssignment.findMany as any)({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      (this.prisma.operationalPersonAssignment.count as any)({ where }),
    ]);

    const data = rows.map((row: any) => {
      const temporalStatus = this.deriveTemporalStatus(row.effectiveFrom, row.effectiveTo, row.status === 'ACTIVE');
      return {
        id: row.id,
        person: row.person,
        personCode: row.person?.code,
        leadershipLevel: row.leadershipLevel,
        assignmentType: row.assignmentType,
        jobTitle: row.jobTitle,
        department: row.department,
        branch: row.branch,
        administration: row.administration,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        isActive: row.status === 'ACTIVE',
        status: row.status,
        temporalStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
