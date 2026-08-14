import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerAddressDto } from './dto/create-address.dto';
import { UpdateBusinessPartnerAddressDto } from './dto/update-address.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class BusinessPartnerAddressesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerAddressDto, ctx: ActiveOperationalContext) {
    await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerAddress.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string; type?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } };
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const address = await this.prisma.businessPartnerAddress.findFirst({
      where: { id, deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(id: string, dto: UpdateBusinessPartnerAddressDto, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    if (dto.partnerId) await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerAddress.update({ where: { id }, data: dto });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.businessPartnerAddress.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Address deleted successfully' };
  }

  private async assertPartnerOwned(partnerId: string, ctx: ActiveOperationalContext) {
    const partner = await this.prisma.businessPartner.findFirst({ where: { id: partnerId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, select: { id: true } });
    if (!partner) throw new NotFoundException('Business partner not found');
  }
}
