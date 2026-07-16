import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateSystemSettingDto } from '../dto/create-system-setting.dto';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';

@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSystemSettingDto) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException('Setting key already exists');
    return this.prisma.systemSetting.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; group?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { key: { contains: query.search } },
        { label: { contains: query.search } },
      ];
    }
    if (query.group) where.group = query.group;

    const [data, total] = await Promise.all([
      this.prisma.systemSetting.findMany({ where, skip, take: limit, orderBy: { group: 'asc' } }),
      this.prisma.systemSetting.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id } });
    if (!setting) throw new NotFoundException('System setting not found');
    return setting;
  }

  async update(id: string, dto: UpdateSystemSettingDto) {
    await this.findOne(id);
    return this.prisma.systemSetting.update({ where: { id }, data: dto });
  }

  async findByGroup(group: string) {
    return this.prisma.systemSetting.findMany({ where: { group, status: 'ACTIVE' } });
  }
}
