import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBusinessPartnerBankAccountDto } from './dto/update-bank-account.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class BusinessPartnerBankAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerBankAccountDto, ctx: ActiveOperationalContext) {
    await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerBankAccount.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } };
    if (query.partnerId) where.partnerId = query.partnerId;

    const [data, total] = await Promise.all([
      this.prisma.businessPartnerBankAccount.findMany({
        where, skip, take: limit, orderBy: { isPrimary: 'desc' },
      }),
      this.prisma.businessPartnerBankAccount.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const account = await this.prisma.businessPartnerBankAccount.findFirst({
      where: { id, deletedAt: null, partner: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  async update(id: string, dto: UpdateBusinessPartnerBankAccountDto, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    if (dto.partnerId) await this.assertPartnerOwned(dto.partnerId, ctx);
    return this.prisma.businessPartnerBankAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.businessPartnerBankAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Bank account deleted successfully' };
  }

  private async assertPartnerOwned(partnerId: string, ctx: ActiveOperationalContext) {
    const partner = await this.prisma.businessPartner.findFirst({ where: { id: partnerId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, select: { id: true } });
    if (!partner) throw new NotFoundException('Business partner not found');
  }
}
