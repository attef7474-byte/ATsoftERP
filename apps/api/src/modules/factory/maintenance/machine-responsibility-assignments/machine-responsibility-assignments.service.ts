import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMachineResponsibilityAssignmentDto, UpdateMachineResponsibilityAssignmentDto } from './dto/create-machine-responsibility-assignment.dto';

@Injectable()
export class MachineResponsibilityAssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMachineResponsibilityAssignmentDto) {
    return this.prisma.machineResponsibilityAssignment.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: { select: { id: true, code: true, name: true, role: true } },
      },
    });
  }

  async findAll(query: { page?: number; limit?: number; machineId?: string; maintenancePersonnelId?: string; responsibilityRole?: string; status?: string; isPrimary?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.machineId) where.machineId = query.machineId;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.responsibilityRole) where.responsibilityRole = query.responsibilityRole;
    if (query.status) where.status = query.status;
    if (query.isPrimary !== undefined) where.isPrimary = query.isPrimary === 'true';

    const [data, total] = await Promise.all([
      this.prisma.machineResponsibilityAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          maintenancePersonnel: { select: { id: true, code: true, name: true, role: true } },
        },
      }),
      this.prisma.machineResponsibilityAssignment.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const record = await this.prisma.machineResponsibilityAssignment.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, location: true } },
        maintenancePersonnel: { select: { id: true, code: true, name: true, role: true, specialty: true, phone: true, email: true } },
      },
    });
    if (!record) throw new NotFoundException('Machine responsibility assignment not found');
    return record;
  }

  async update(id: string, dto: UpdateMachineResponsibilityAssignmentDto) {
    await this.findOne(id);
    return this.prisma.machineResponsibilityAssignment.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : dto.endDate === null ? null : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.machineResponsibilityAssignment.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
