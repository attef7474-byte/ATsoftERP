import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMaintenancePartAccountabilityDto, UpdateMaintenancePartAccountabilityDto } from './dto/create-maintenance-part-accountability.dto';

@Injectable()
export class MaintenancePartAccountabilityService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMaintenancePartAccountabilityDto) {
    const result = await this.prisma.maintenancePartAccountability.create({
      data: dto,
      include: {
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        sparePart: { select: { id: true, code: true, name: true, partNumber: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    return this.mapRecord(result);
  }

  async findAll(query: { page?: number; limit?: number; maintenanceRequestId?: string; sparePartId?: string; maintenancePersonnelId?: string; machineId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.maintenancePartAccountability.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
          requiredPart: { select: { id: true, quantity: true } },
          sparePart: { select: { id: true, code: true, name: true, partNumber: true } },
          machine: { select: { id: true, code: true, name: true } },
          machineComponent: { select: { id: true, code: true, name: true } },
          maintenancePersonnel: {
            select: {
              id: true,
              role: true,
              operationalPerson: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.maintenancePartAccountability.count({ where }),
    ]);
    return { data: data.map(r => this.mapRecord(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const record = await this.prisma.maintenancePartAccountability.findUnique({
      where: { id },
      include: {
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true, status: true } },
        requiredPart: true,
        sparePart: { select: { id: true, code: true, name: true, partNumber: true, category: true } },
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true, componentType: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            specialty: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Part accountability record not found');
    return this.mapRecord(record);
  }

  async update(id: string, dto: UpdateMaintenancePartAccountabilityDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.reportedAt) data.reportedAt = new Date(dto.reportedAt);
    if (dto.cancelledAt) data.cancelledAt = new Date(dto.cancelledAt);
    const result = await this.prisma.maintenancePartAccountability.update({
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
    return this.mapRecord(result);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.maintenancePartAccountability.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  private mapRecord(r: any) {
    return {
      ...r,
      maintenancePersonnel: {
        id: r.maintenancePersonnel.id,
        code: r.maintenancePersonnel.operationalPerson?.code ?? null,
        name: r.maintenancePersonnel.operationalPerson?.name ?? null,
        role: r.maintenancePersonnel.role,
        specialty: r.maintenancePersonnel.specialty,
      },
    };
  }
}
