import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateSupervisorAssignmentDto } from './dto/create-supervisor-assignment.dto';
import { UpdateSupervisorAssignmentDto } from './dto/update-supervisor-assignment.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const MAX_HIERARCHY_DEPTH = 100;

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
    const assignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id: dto.assignmentId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!assignment) throw this.validationError('assignmentId', 'validation.invalidReference', 'Assignment not found in current company');

    if (dto.supervisorAssignmentId) {
      const supervisorAssignment = await this.prisma.operationalPersonAssignment.findFirst({
        where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found in current company');

      if (assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
      }

      const wouldCycle = await this.detectCycle(dto.assignmentId, dto.supervisorAssignmentId);
      if (wouldCycle) {
        throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
      }
    }

    const supervisorAssignment = await this.prisma.supervisorAssignment.create({
      data: {
        companyId: ctx.companyId,
        assignmentId: dto.assignmentId,
        supervisorAssignmentId: dto.supervisorAssignmentId ?? null,
        relationshipType: dto.relationshipType ?? 'DIRECT',
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
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

    if (dto.supervisorAssignmentId !== undefined && dto.supervisorAssignmentId !== existing.supervisorAssignmentId) {
      if (dto.supervisorAssignmentId) {
        const supervisorAssignment = await this.prisma.operationalPersonAssignment.findFirst({
          where: { id: dto.supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null },
        });
        if (!supervisorAssignment) throw this.validationError('supervisorAssignmentId', 'validation.invalidReference', 'Supervisor assignment not found');

        if (existing.assignment.personnelId === supervisorAssignment.personnelId) {
          throw this.validationError('supervisorAssignmentId', 'validation.selfReference', 'A person cannot be their own supervisor');
        }

        const wouldCycle = await this.detectCycle(existing.assignmentId, dto.supervisorAssignmentId, id);
        if (wouldCycle) {
          throw this.validationError('supervisorAssignmentId', 'validation.cycleDetected', 'Adding this supervisor would create a cycle in the reporting hierarchy');
        }
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

  async getReportingLine(assignmentId: string, ctx: ActiveOperationalContext) {
    const line: any[] = [];
    let currentAssignmentId: string | null = assignmentId;
    const visited = new Set<string>();

    while (currentAssignmentId && line.length < MAX_HIERARCHY_DEPTH) {
      if (visited.has(currentAssignmentId)) break;
      visited.add(currentAssignmentId);

      const sa: any = await this.prisma.supervisorAssignment.findFirst({
        where: {
          assignmentId: currentAssignmentId,
          companyId: ctx.companyId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          supervisorAssignmentId: true,
          relationshipType: true,
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

      line.push({
        level: line.length + 1,
        supervisor: sa.supervisorAssignment.person,
        department: sa.supervisorAssignment.department,
        jobTitle: sa.supervisorAssignment.jobTitle,
        relationshipType: sa.relationshipType,
      });

      currentAssignmentId = sa.supervisorAssignmentId;
    }

    return { assignmentId, reportingLine: line, depth: line.length };
  }

  async getSubordinates(assignmentId: string, ctx: ActiveOperationalContext) {
    const subordinates: any[] = [];
    const queue: string[] = [assignmentId];
    const visited = new Set<string>();

    while (queue.length > 0 && subordinates.length < MAX_HIERARCHY_DEPTH) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = await this.prisma.supervisorAssignment.findMany({
        where: {
          supervisorAssignmentId: currentId,
          companyId: ctx.companyId,
          isActive: true,
          deletedAt: null,
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
        subordinates.push({
          level: subordinates.length + 1,
          assignment: child.assignment,
          relationshipType: child.relationshipType,
        });
        queue.push(child.assignmentId);
      }
    }

    return { assignmentId, subordinates, count: subordinates.length };
  }

  private async detectCycle(assignmentId: string, newSupervisorAssignmentId: string, excludeId?: string): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = newSupervisorAssignmentId;
    let depth = 0;

    while (currentId && depth < MAX_HIERARCHY_DEPTH) {
      if (currentId === assignmentId) return true;
      if (visited.has(currentId)) return true;
      visited.add(currentId);

      const sa: any = await this.prisma.supervisorAssignment.findFirst({
        where: {
          assignmentId: currentId,
          isActive: true,
          deletedAt: null,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { supervisorAssignmentId: true },
      });

      if (!sa || !sa.supervisorAssignmentId) break;
      currentId = sa.supervisorAssignmentId;
      depth++;
    }

    return false;
  }
}
