import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerContactDto } from './dto/create-contact.dto';
import { UpdateBusinessPartnerContactDto } from './dto/update-contact.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class BusinessPartnerContactsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerContactDto, ctx: ActiveOperationalContext) {
    await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerContact.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string; search?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } };
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.businessPartnerContact.findMany({
        where, skip, take: limit, orderBy: { isPrimary: 'desc' },
      }),
      this.prisma.businessPartnerContact.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const contact = await this.prisma.businessPartnerContact.findFirst({
      where: { id, deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(id: string, dto: UpdateBusinessPartnerContactDto, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    if (dto.partnerId) await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerContact.update({ where: { id }, data: dto });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.businessPartnerContact.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Contact deleted successfully' };
  }

  private async assertPartnerOwned(partnerId: string, ctx: ActiveOperationalContext) {
    const partner = await this.prisma.businessPartner.findFirst({ where: { id: partnerId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, select: { id: true } });
    if (!partner) throw new NotFoundException('Business partner not found');
  }
}
