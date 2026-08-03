import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ProductionOperationalPeopleService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; page?: number; limit?: number; isActive?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.operationalPerson.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          isActive: true,
          phone: true,
          email: true,
          notes: true,
        },
      }),
      this.prisma.operationalPerson.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const person = await this.prisma.operationalPerson.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        isActive: true,
        phone: true,
        email: true,
        notes: true,
      },
    });
    if (!person) throw new NotFoundException({ messageKey: 'production.operationalPersonNotFound', message: 'Operational person not found' });
    return person;
  }
}