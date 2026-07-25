import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMaintenanceRequestAssignmentDto, UpdateMaintenanceRequestAssignmentDto } from './dto/create-maintenance-request-assignment.dto';

@Injectable()
export class MaintenanceRequestAssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMaintenanceRequestAssignmentDto) {
    const result = await this.prisma.maintenanceRequestAssignment.create({
      data: dto,
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
    return this.mapAssignment(result);
  }

  async findAll(query: { page?: number; limit?: number; maintenanceRequestId?: string; maintenancePersonnelId?: string; assignmentRole?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
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

  async findOne(id: string) {
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
    if (!record) throw new NotFoundException('Maintenance request assignment not found');
    return this.mapAssignment(record);
  }

  async update(id: string, dto: UpdateMaintenanceRequestAssignmentDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.acceptedAt) data.acceptedAt = new Date(dto.acceptedAt);
    if (dto.startedAt) data.startedAt = new Date(dto.startedAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    if (dto.cancelledAt) data.cancelledAt = new Date(dto.cancelledAt);
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
    return this.mapAssignment(result);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.maintenanceRequestAssignment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
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
