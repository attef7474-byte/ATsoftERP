import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateMaintenancePersonnelDto, UpdateMaintenancePersonnelDto } from './dto/create-maintenance-personnel.dto';

@Injectable()
export class MaintenancePersonnelService {
  constructor(private prisma: PrismaService, private numberingService: NumberingService) {}

  async create(dto: CreateMaintenancePersonnelDto) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MAINTENANCE_PERSONNEL');
    const existing = await this.prisma.operationalPerson.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Personnel code already exists');

    if (dto.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user) throw new BadRequestException('User not found');
      const conflict = await this.prisma.operationalPerson.findFirst({ where: { userId: dto.userId } });
      if (conflict) throw new ConflictException('User is already linked to another operational person');
    }

    return this.prisma.$transaction(async (tx) => {
      const operationalPerson = await tx.operationalPerson.create({
        data: {
          code,
          name: dto.name,
          category: 'MAINTENANCE',
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          notes: dto.notes ?? null,
          userId: dto.userId ?? null,
          isActive: dto.isActive ?? true,
        },
      });

      const personnel = await tx.maintenancePersonnel.create({
        data: {
          operationalPersonId: operationalPerson.id,
          role: dto.role,
          specialty: dto.specialty ?? null,
          isActive: dto.isActive ?? true,
        },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      return this.mapPersonnel(personnel);
    });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; role?: string; specialty?: string; isActive?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.search) {
      where.operationalPerson = {
        OR: [
          { code: { contains: query.search } },
          { name: { contains: query.search } },
          { email: { contains: query.search } },
          { phone: { contains: query.search } },
        ],
      };
    }
    if (query.role) where.role = query.role;
    if (query.specialty) where.specialty = query.specialty;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.maintenancePersonnel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      this.prisma.maintenancePersonnel.count({ where }),
    ]);
    return { data: data.map(r => this.mapPersonnel(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const record = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: {
        operationalPerson: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        machineResponsibilities: { include: { machine: { select: { id: true, code: true, name: true } } } },
        requestAssignments: { include: { maintenanceRequest: { select: { id: true, requestNumber: true, title: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Maintenance personnel not found');
    return this.mapPersonnel(record);
  }

  async update(id: string, dto: UpdateMaintenancePersonnelDto) {
    const existing = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    if (dto.code && dto.code !== existing.operationalPerson.code) {
      const conflict = await this.prisma.operationalPerson.findUnique({ where: { code: dto.code } });
      if (conflict) throw new ConflictException('Personnel code already exists');
    }

    if (dto.userId !== undefined && dto.userId !== existing.operationalPerson.userId) {
      if (dto.userId) {
        const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
        if (!user) throw new BadRequestException('User not found');
        const conflict = await this.prisma.operationalPerson.findFirst({ where: { userId: dto.userId, id: { not: existing.operationalPersonId } } });
        if (conflict) throw new ConflictException('User is already linked to another operational person');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({
        where: { id: existing.operationalPersonId },
        data: {
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: {
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.specialty !== undefined ? { specialty: dto.specialty } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      return this.mapPersonnel(updated);
    });
  }

  async activate(id: string) {
    const existing = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: true } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: true },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return this.mapPersonnel(updated);
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: false } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: false },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return this.mapPersonnel(updated);
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: { operationalPerson: true },
    });
    if (!existing) throw new NotFoundException('Maintenance personnel not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPerson.update({ where: { id: existing.operationalPersonId }, data: { isActive: false } });
      const updated = await tx.maintenancePersonnel.update({
        where: { id },
        data: { isActive: false },
        include: {
          operationalPerson: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return this.mapPersonnel(updated);
    });
  }

  private mapPersonnel(r: any) {
    return {
      id: r.id,
      role: r.role,
      specialty: r.specialty,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      operationalPersonId: r.operationalPersonId,
      code: r.operationalPerson?.code ?? null,
      name: r.operationalPerson?.name ?? null,
      phone: r.operationalPerson?.phone ?? null,
      email: r.operationalPerson?.email ?? null,
      notes: r.operationalPerson?.notes ?? null,
      userId: r.operationalPerson?.userId ?? null,
      user: r.operationalPerson?.user ?? null,
      machineResponsibilities: r.machineResponsibilities,
      requestAssignments: r.requestAssignments,
    };
  }
}
