import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { CreateMaintenancePersonnelDto, UpdateMaintenancePersonnelDto } from './dto/create-maintenance-personnel.dto';

@Injectable()
export class MaintenancePersonnelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMaintenancePersonnelDto) {
    const existing = await this.prisma.maintenancePersonnel.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Personnel code already exists');
    return this.prisma.maintenancePersonnel.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; role?: string; specialty?: string; isActive?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
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
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.maintenancePersonnel.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const record = await this.prisma.maintenancePersonnel.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        machineResponsibilities: { include: { machine: { select: { id: true, code: true, name: true } } } },
        requestAssignments: { include: { maintenanceRequest: { select: { id: true, requestNumber: true, title: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Maintenance personnel not found');
    return record;
  }

  async update(id: string, dto: UpdateMaintenancePersonnelDto) {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.prisma.maintenancePersonnel.findUnique({ where: { code: dto.code } });
      if (existing && existing.id !== id) throw new ConflictException('Personnel code already exists');
    }
    return this.prisma.maintenancePersonnel.update({ where: { id }, data: dto });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.maintenancePersonnel.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.maintenancePersonnel.update({ where: { id }, data: { isActive: false } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.maintenancePersonnel.update({ where: { id }, data: { isActive: false } });
  }
}
