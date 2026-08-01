import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceRequestAssignmentDto, UpdateMaintenanceRequestAssignmentDto } from './dto/create-maintenance-request-assignment.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceRequestAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
  }

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  async create(dto: CreateMaintenanceRequestAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: dto.maintenanceRequestId },
      include: { machine: true },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) {
      throw this.validationError('maintenanceRequestId', 'validation.invalidReference', 'Maintenance request not found');
    }
    const personnel = await this.prisma.maintenancePersonnel.findUnique({ where: { id: dto.maintenancePersonnelId } });
    if (!personnel) throw this.validationError('maintenancePersonnelId', 'validation.invalidReference', 'Maintenance personnel not found');

    const result = await this.prisma.maintenanceRequestAssignment.create({
      data: { ...dto, status: dto.status || 'ACTIVE' },
      include: {
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true, status: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestAssignment', result.id,
      { maintenanceRequestId: dto.maintenanceRequestId, maintenancePersonnelId: dto.maintenancePersonnelId, assignmentRole: dto.assignmentRole });
    return this.mapAssignment(result);
  }

  async findAll(query: { page?: number; limit?: number; maintenanceRequestId?: string; maintenancePersonnelId?: string; assignmentRole?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { maintenanceRequest: { machine: this.machineScope(ctx) } };
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.assignmentRole) where.assignmentRole = query.assignmentRole;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequestAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          maintenanceRequest: { select: { id: true, requestNumber: true, title: true, status: true, priority: true } },
          maintenancePersonnel: {
            select: {
              id: true,
              role: true,
              operationalPerson: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.maintenanceRequestAssignment.count({ where }),
    ]);
    return { data: data.map(r => this.mapAssignment(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const record = await this.prisma.maintenanceRequestAssignment.findUnique({
      where: { id },
      include: {
        maintenanceRequest: {
          select: { id: true, requestNumber: true, title: true, description: true, status: true, priority: true, startDate: true, endDate: true },
        },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            specialty: true,
            operationalPerson: { select: { id: true, code: true, name: true, phone: true, email: true } },
          },
        },
      },
    });
    if (!record) throw this.notFound('maintenance.assignmentNotFound', 'Maintenance request assignment not found');

    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: record.maintenanceRequestId },
      include: { machine: true },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) {
      throw this.notFound('maintenance.assignmentNotFound', 'Maintenance request assignment not found');
    }
    return this.mapAssignment(record);
  }

  async update(id: string, dto: UpdateMaintenanceRequestAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const previous = await this.findOne(id, ctx);
    const data: any = { ...dto };
    if (dto.acceptedAt) data.acceptedAt = new Date(dto.acceptedAt);
    if (dto.startedAt) data.startedAt = new Date(dto.startedAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    if (dto.cancelledAt) data.cancelledAt = new Date(dto.cancelledAt);
    if (dto.status && dto.status === 'CANCELLED' && !data.cancelledAt) data.cancelledAt = new Date();
    const result = await this.prisma.maintenanceRequestAssignment.update({
      where: { id },
      data,
      include: {
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestAssignment', id,
      { oldStatus: previous.status, newStatus: result.status, dto });
    return this.mapAssignment(result);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const previous = await this.findOne(id, ctx);
    const result = await this.prisma.maintenanceRequestAssignment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequestAssignment', id,
      { oldStatus: previous.status, newStatus: 'CANCELLED' });
    return result;
  }

  private mapAssignment(r: any) {
    return {
      ...r,
      maintenancePersonnel: {
        id: r.maintenancePersonnel.id,
        code: r.maintenancePersonnel.operationalPerson?.code ?? null,
        name: r.maintenancePersonnel.operationalPerson?.name ?? null,
        role: r.maintenancePersonnel.role,
        specialty: r.maintenancePersonnel.specialty,
        phone: r.maintenancePersonnel.operationalPerson?.phone ?? null,
        email: r.maintenancePersonnel.operationalPerson?.email ?? null,
      },
    };
  }
}
