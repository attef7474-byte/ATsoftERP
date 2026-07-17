import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { UpdatePrintJobDto } from './dto/update-print-job.dto';
import { PrintJobQueryDto } from './dto/print-job-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BarcodePrintJobsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePrintJobDto, userId: string) {
    const job = await this.prisma.barcodePrintJob.create({
      data: {
        labelId: dto.labelId,
        templateId: dto.templateId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        printerName: dto.printerName,
        copies: dto.copies ?? 1,
        jobType: dto.jobType ?? 'LABEL',
        note: dto.note,
        printedById: userId,
        requestedAt: new Date(),
        status: 'PENDING',
      },
    });

    await this.audit.log(userId, 'CREATE', 'BarcodePrintJob', job.id, {
      jobType: job.jobType, entityType: job.entityType, entityId: job.entityId, copies: job.copies,
    });

    return job;
  }

  async findAll(query: PrintJobQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.BarcodePrintJobWhereInput = {};

    if (query.search) {
      where.OR = [
        { entityId: { contains: query.search } },
        { printerName: { contains: query.search } },
        { note: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.jobType) where.jobType = query.jobType;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const [data, total] = await Promise.all([
      this.prisma.barcodePrintJob.findMany({ where, skip, take: limit, orderBy: { requestedAt: 'desc' } }),
      this.prisma.barcodePrintJob.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const job = await this.prisma.barcodePrintJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Barcode print job not found');
    return job;
  }

  async updateStatus(id: string, dto: UpdatePrintJobDto, userId: string) {
    const job = await this.findOne(id);
    const data: any = { status: dto.status };
    if (dto.status === 'COMPLETED') data.completedAt = new Date();

    const updated = await this.prisma.barcodePrintJob.update({ where: { id }, data });

    await this.audit.log(userId, 'UPDATE_STATUS', 'BarcodePrintJob', id, {
      oldStatus: job.status, newStatus: dto.status,
    });

    return updated;
  }

  async findByEntity(entityType: string, entityId: string) {
    const data = await this.prisma.barcodePrintJob.findMany({
      where: { entityType, entityId },
      orderBy: { requestedAt: 'desc' },
    });
    return { data };
  }

  async getSummary() {
    const [total, pending, printing, completed, failed] = await Promise.all([
      this.prisma.barcodePrintJob.count(),
      this.prisma.barcodePrintJob.count({ where: { status: 'PENDING' } }),
      this.prisma.barcodePrintJob.count({ where: { status: 'PRINTING' } }),
      this.prisma.barcodePrintJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.barcodePrintJob.count({ where: { status: 'FAILED' } }),
    ]);

    return { total, pending, printing, completed, failed };
  }
}
