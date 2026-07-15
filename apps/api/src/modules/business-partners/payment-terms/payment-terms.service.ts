import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePaymentTermDto } from './dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from './dto/update-payment-term.dto';

@Injectable()
export class PaymentTermsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePaymentTermDto) {
    const existing = await this.prisma.paymentTerm.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Payment term code already exists');
    return this.prisma.paymentTerm.create({ data: dto });
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
      this.prisma.paymentTerm.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { partners: true } } },
      }),
      this.prisma.paymentTerm.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const term = await this.prisma.paymentTerm.findUnique({
      where: { id },
      include: { _count: { select: { partners: true } } },
    });
    if (!term) throw new NotFoundException('Payment term not found');
    return term;
  }

  async update(id: string, dto: UpdatePaymentTermDto) {
    await this.findOne(id);
    return this.prisma.paymentTerm.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.paymentTerm.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Payment term deleted successfully' };
  }
}
