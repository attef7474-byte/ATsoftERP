import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateOperationTypeDto } from './dto/create-operation-type.dto';
import { UpdateOperationTypeDto } from './dto/update-operation-type.dto';

@Injectable()
export class OperationTypesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateOperationTypeDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('OPERATION_TYPE');
    const existing = await this.prisma.operationType.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Operation type code already exists');

    const item = await this.prisma.operationType.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'OperationType', item.id, { message: `Created operation type: ${item.code}` });
    return item;
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
      this.prisma.operationType.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.operationType.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.operationType.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Operation type not found');
    return item;
  }

  async update(id: string, dto: UpdateOperationTypeDto, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.operationType.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'OperationType', id, { message: `Updated operation type: ${item.code}` });
    return item;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.operationType.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'OperationType', id, { message: `Deleted operation type: ${id}` });
    return { message: 'Operation type deleted successfully' };
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.operationType.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'OperationType', id);
    return item;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.operationType.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'OperationType', id);
    return item;
  }
}
