import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateNumberSequenceDto } from './dto/create-number-sequence.dto';
import { UpdateNumberSequenceDto } from './dto/update-number-sequence.dto';

@Injectable()
export class NumberingService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNumberSequenceDto) {
    return this.prisma.numberSequence.create({ data: dto });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.numberSequence.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.numberSequence.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const seq = await this.prisma.numberSequence.findUnique({ where: { id } });
    if (!seq) throw new NotFoundException('Number sequence not found');
    return seq;
  }

  async findByCode(code: string) {
    const seq = await this.prisma.numberSequence.findUnique({ where: { code } });
    if (!seq) throw new NotFoundException('Number sequence not found');
    return seq;
  }

  async update(id: string, dto: UpdateNumberSequenceDto) {
    await this.findOne(id);
    return this.prisma.numberSequence.update({ where: { id }, data: dto });
  }

  async generateNumber(code: string) {
    const seq = await this.prisma.numberSequence.findUnique({ where: { code } });
    if (!seq) throw new NotFoundException('Number sequence not found');

    const nextNumber = seq.currentNumber + 1;
    const padded = String(nextNumber).padStart(seq.padding, '0');
    const generated = `${seq.prefix}${padded}${seq.suffix || ''}`;

    await this.prisma.numberSequence.update({
      where: { id: seq.id },
      data: { currentNumber: nextNumber },
    });

    return { number: generated, sequence: seq.code, currentNumber: nextNumber };
  }
}
