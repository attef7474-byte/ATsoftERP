import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private hasCurrentAssignmentWhere(ctx: ActiveOperationalContext) {
    const now = new Date();
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    };
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      assignments: { some: this.hasCurrentAssignmentWhere(ctx) },
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.operationalPerson.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          isActive: true,
          phone: true,
          email: true,
          notes: true,
        },
      }),
      this.prisma.operationalPerson.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const person = await this.prisma.operationalPerson.findFirst({
      where: {
        id,
        assignments: { some: this.hasCurrentAssignmentWhere(ctx) },
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        isActive: true,
        phone: true,
        email: true,
        notes: true,
      },
    });
    if (!person) {
      throw new NotFoundException({ messageKey: 'employees.notFound', message: 'Employee not found in the active branch' });
    }
    return person;
  }

  async create(dto: CreateEmployeeDto, ctx: ActiveOperationalContext) {
    const code = dto.code.trim();
    const category = dto.category ?? 'MAINTENANCE';

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.operationalPerson.findUnique({ where: { code } });
        if (existing) {
          throw new ConflictException({
            messageKey: 'employees.duplicateCode',
            message: 'Employee code already exists',
            errors: [{ field: 'code', code: 'employees.duplicateCode', message: 'Employee code already exists' }],
          });
        }

        const department = await tx.department.findFirst({
          where: { id: dto.departmentId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!department) {
          throw this.validationError('departmentId', 'validation.invalidReference', 'Department not found in the active branch');
        }

        const person = await tx.operationalPerson.create({
          data: {
            code,
            name: dto.name,
            category,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            notes: dto.notes ?? null,
            isActive: dto.isActive ?? true,
          },
        });

        await tx.operationalPersonAssignment.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            departmentId: dto.departmentId,
            personnelId: person.id,
            assignmentType: dto.assignmentType ?? 'PRIMARY',
            leadershipLevel: 'NONE',
            effectiveFrom: new Date(),
          },
        });

        return person;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({
          messageKey: 'employees.duplicateCode',
          message: 'Employee code already exists',
          errors: [{ field: 'code', code: 'employees.duplicateCode', message: 'Employee code already exists' }],
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, ctx: ActiveOperationalContext) {
    const person = await this.findOne(id, ctx);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.phone !== undefined) data.phone = dto.phone ?? null;
    if (dto.email !== undefined) data.email = dto.email ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    if (dto.code !== undefined) {
      const code = dto.code.trim();
      const dupe = await this.prisma.operationalPerson.findFirst({ where: { code, NOT: { id } } });
      if (dupe) {
        throw this.validationError('code', 'validation.duplicateValue', 'Employee code already exists');
      }
      data.code = code;
    }

    return this.prisma.operationalPerson.update({ where: { id: person.id }, data });
  }

  async deactivate(id: string, ctx: ActiveOperationalContext) {
    const person = await this.findOne(id, ctx);
    if (!person.isActive) {
      throw new BadRequestException({ messageKey: 'employees.alreadyInactive', message: 'Employee is already inactive' });
    }
    return this.prisma.operationalPerson.update({ where: { id: person.id }, data: { isActive: false } });
  }

  async activate(id: string, ctx: ActiveOperationalContext) {
    const person = await this.findOne(id, ctx);
    if (person.isActive) {
      throw new BadRequestException({ messageKey: 'employees.alreadyActive', message: 'Employee is already active' });
    }
    return this.prisma.operationalPerson.update({ where: { id: person.id }, data: { isActive: true } });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);

    return this.prisma.$transaction(async (tx) => {
      const referenceCounts = await Promise.all([
        tx.maintenancePersonnel.count({ where: { operationalPersonId: id } }),
        tx.productionShiftAssignment.count({ where: { operationalPersonId: id } }),
        tx.operationalPersonAssignment.count({ where: { personnelId: id } }),
        tx.shiftHandover.count({
          where: { OR: [{ outgoingPersonId: id }, { incomingPersonId: id }] },
        }),
        tx.productionRun.count({ where: { operationalPersonId: id } }),
      ]);

      const totalReferences = referenceCounts.reduce((sum, n) => sum + n, 0);
      if (totalReferences > 0) {
        throw new BadRequestException({
          messageKey: 'employees.hasReferences',
          message: 'This employee cannot be deleted because related records exist. Deactivate the employee instead.',
        });
      }

      await tx.operationalPerson.delete({ where: { id } });
      return { message: 'Employee deleted successfully' };
    });
  }
}
