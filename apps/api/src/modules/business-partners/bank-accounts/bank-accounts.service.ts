import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBusinessPartnerBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BusinessPartnerBankAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerBankAccountDto) {
    return this.prisma.businessPartnerBankAccount.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.partnerId) where.partnerId = query.partnerId;

    const [data, total] = await Promise.all([
      this.prisma.businessPartnerBankAccount.findMany({
        where, skip, take: limit, orderBy: { isPrimary: 'desc' },
      }),
      this.prisma.businessPartnerBankAccount.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const account = await this.prisma.businessPartnerBankAccount.findUnique({
      where: { id },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  async update(id: string, dto: UpdateBusinessPartnerBankAccountDto) {
    await this.findOne(id);
    return this.prisma.businessPartnerBankAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.businessPartnerBankAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Bank account deleted successfully' };
  }
}
