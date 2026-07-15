import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerGroupDto } from './dto/create-group.dto';
import { UpdateBusinessPartnerGroupDto } from './dto/update-group.dto';

@Injectable()
export class BusinessPartnerGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerGroupDto) {
    const existing = await this.prisma.businessPartnerGroup.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Group code already exists');
    return this.prisma.businessPartnerGroup.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.businessPartnerGroup.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { partners: true } } },
      }),
      this.prisma.businessPartnerGroup.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const group = await this.prisma.businessPartnerGroup.findUnique({
      where: { id },
      include: { _count: { select: { partners: true } } },
    });
    if (!group) throw new NotFoundException('Business partner group not found');
    return group;
  }

  async update(id: string, dto: UpdateBusinessPartnerGroupDto) {
    await this.findOne(id);
    return this.prisma.businessPartnerGroup.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.businessPartnerGroup.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Business partner group deleted successfully' };
  }
}
