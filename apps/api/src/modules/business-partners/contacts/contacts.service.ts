import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBusinessPartnerContactDto } from './dto/create-contact.dto';
import { UpdateBusinessPartnerContactDto } from './dto/update-contact.dto';

@Injectable()
export class BusinessPartnerContactsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessPartnerContactDto) {
    return this.prisma.businessPartnerContact.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; partnerId?: string; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
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

  async findOne(id: string) {
    const contact = await this.prisma.businessPartnerContact.findUnique({
      where: { id },
      include: { partner: { select: { id: true, code: true, name: true } } },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(id: string, dto: UpdateBusinessPartnerContactDto) {
    await this.findOne(id);
    return this.prisma.businessPartnerContact.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.businessPartnerContact.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Contact deleted successfully' };
  }
}
