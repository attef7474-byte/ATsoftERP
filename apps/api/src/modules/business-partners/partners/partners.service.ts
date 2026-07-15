import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerDto } from './dto/create-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-partner.dto';

@Injectable()
export class BusinessPartnersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerDto) {
    const existing = await this.prisma.businessPartner.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Business partner code already exists');
    return this.prisma.businessPartner.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string; type?: string; isCustomer?: boolean; isSupplier?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.isCustomer !== undefined) where.isCustomer = query.isCustomer;
    if (query.isSupplier !== undefined) where.isSupplier = query.isSupplier;

    const [data, total] = await Promise.all([
      this.prisma.businessPartner.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          group: true,
          paymentTerm: true,
          _count: { select: { contacts: true, addresses: true, bankAccounts: true } },
        },
      }),
      this.prisma.businessPartner.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id },
      include: {
        group: true,
        paymentTerm: true,
        contacts: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' } },
        addresses: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' } },
        bankAccounts: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' } },
      },
    });
    if (!partner) throw new NotFoundException('Business partner not found');
    return partner;
  }

  async update(id: string, dto: UpdateBusinessPartnerDto) {
    await this.findOne(id);
    return this.prisma.businessPartner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.businessPartner.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Business partner deleted successfully' };
  }
}
