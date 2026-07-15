import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerAddressDto } from './dto/create-address.dto';
import { UpdateBusinessPartnerAddressDto } from './dto/update-address.dto';

@Injectable()
export class BusinessPartnerAddressesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerAddressDto) {
    return this.prisma.businessPartnerAddress.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string; type?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.businessPartnerAddress.findMany({
        where, skip, take: limit, orderBy: { isPrimary: 'desc' },
      }),
      this.prisma.businessPartnerAddress.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const address = await this.prisma.businessPartnerAddress.findUnique({
      where: { id },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(id: string, dto: UpdateBusinessPartnerAddressDto) {
    await this.findOne(id);
    return this.prisma.businessPartnerAddress.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.businessPartnerAddress.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Address deleted successfully' };
  }
}
