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

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
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
    if (query.status) {
      where.status = query.status;
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

  async preview(id: string) {
    const seq = await this.findOne(id);
    const nextNumber = await this.computeNextNumber(seq);
    const generated = this.formatNumber(seq, nextNumber);
    return { number: generated, sequence: seq.code, currentNumber: seq.currentNumber, nextNumber };
  }

  async generateNumber(code: string) {
    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.numberSequence.findUnique({ where: { code } });
      if (!seq) throw new NotFoundException('Number sequence not found');

      const nextNumber = await this.computeNextNumber(seq);
      const generated = this.formatNumber(seq, nextNumber);

      await tx.numberSequence.update({
        where: { id: seq.id },
        data: {
          currentNumber: nextNumber,
          lastGeneratedCode: generated,
          lastResetAt: this.shouldReset(seq) ? new Date() : undefined
        },
      });

      return { number: generated, sequence: seq.code, currentNumber: nextNumber };
    });
  }

  async generateNumberAtomic(code: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.numberSequence.findUnique({ where: { code } });
      if (!seq) throw new NotFoundException('Number sequence not found');

      const nextNumber = await this.computeNextNumber(seq);
      const generated = this.formatNumber(seq, nextNumber);

      await tx.numberSequence.update({
        where: { id: seq.id },
        data: {
          currentNumber: nextNumber,
          lastGeneratedCode: generated,
          lastResetAt: this.shouldReset(seq) ? new Date() : undefined
        },
      });

      return generated;
    });
  }

  private formatNumber(seq: { prefix: string; suffix: string | null; padding: number }, nextNumber: number): string {
    const padded = String(nextNumber).padStart(seq.padding, '0');
    return `${seq.prefix}${padded}${seq.suffix || ''}`;
  }

  private async computeNextNumber(seq: { id: string; resetPolicy: string; currentNumber: number; lastResetAt: Date | null; increment: number }): Promise<number> {
    if (this.shouldReset(seq)) {
      return 1;
    }
    return seq.currentNumber + (seq.increment || 1);
  }

  private shouldReset(seq: { id: string; resetPolicy: string; currentNumber: number; lastResetAt: Date | null }): boolean {
    if (!seq.lastResetAt || seq.resetPolicy === 'NEVER') return false;
    const now = new Date();
    const last = new Date(seq.lastResetAt);
    switch (seq.resetPolicy) {
      case 'YEARLY':
        return now.getFullYear() !== last.getFullYear();
      case 'MONTHLY':
        return now.getFullYear() !== last.getFullYear() || now.getMonth() !== last.getMonth();
      case 'DAILY':
        return now.getFullYear() !== last.getFullYear() ||
          now.getMonth() !== last.getMonth() ||
          now.getDate() !== last.getDate();
      default:
        return false;
    }
  }
}