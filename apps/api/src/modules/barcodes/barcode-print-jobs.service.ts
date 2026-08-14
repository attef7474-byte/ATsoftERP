import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { UpdatePrintJobDto } from './dto/update-print-job.dto';
import { PrintJobQueryDto } from './dto/print-job-query.dto';
import { Prisma } from '@prisma/client';
import { BarcodeLabelsService } from './barcode-labels.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@Injectable()
export class BarcodePrintJobsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private labelsService: BarcodeLabelsService,
  ) {}

  private tenantWhere(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  async create(dto: CreatePrintJobDto, userId: string, ctx: ActiveOperationalContext) {
    if (Boolean(dto.entityType) !== Boolean(dto.entityId)) {
      throw new BadRequestException({ messageKey: 'barcodes.entityTypeAndIdRequired' });
    }

    const label = dto.labelId ? await this.labelsService.findOne(dto.labelId, ctx) : null;
    const entityType = dto.entityType ?? label?.entityType;
    const entityId = dto.entityId ?? label?.entityId;
    if (label && ((dto.entityType && dto.entityType !== label.entityType) || (dto.entityId && dto.entityId !== label.entityId))) {
      throw new BadRequestException({ messageKey: 'barcodes.printJobLabelEntityMismatch' });
    }
    if (entityType && entityId) {
      await this.labelsService.assertEntityInContext(entityType, entityId, ctx);
    }
    if (dto.templateId) {
      const template = await this.prisma.barcodeLabelTemplate.findFirst({
        where: { id: dto.templateId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!template) throw new BadRequestException({ messageKey: 'barcodes.invalidTemplateReference' });
    }

    const job = await this.prisma.barcodePrintJob.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        labelId: dto.labelId,
        templateId: dto.templateId,
        entityType,
        entityId,
        printerName: dto.printerName,
        copies: dto.copies ?? 1,
        jobType: dto.jobType ?? 'LABEL',
        note: dto.note,
        printedById: userId,
        requestedAt: new Date(),
        status: 'PENDING',
      } as any,
    });

    await this.audit.log(userId, 'CREATE', 'BarcodePrintJob', job.id, {
      companyId: ctx.companyId, branchId: ctx.branchId,
      jobType: job.jobType, entityType: job.entityType, entityId: job.entityId, copies: job.copies,
    });

    return job;
  }

  async findAll(query: PrintJobQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.BarcodePrintJobWhereInput = { ...this.tenantWhere(ctx), deletedAt: null };

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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const job = await this.prisma.barcodePrintJob.findFirst({
      where: { id, ...this.tenantWhere(ctx), deletedAt: null },
    });
    if (!job) throw new NotFoundException('Barcode print job not found');
    return job;
  }

  async updateStatus(id: string, dto: UpdatePrintJobDto, userId: string, ctx: ActiveOperationalContext) {
    const job = await this.findOne(id, ctx);
    const data: any = { status: dto.status };
    if (dto.status === 'COMPLETED') data.completedAt = new Date();

    const updated = await this.prisma.barcodePrintJob.update({ where: { id }, data });

    await this.audit.log(userId, 'UPDATE_STATUS', 'BarcodePrintJob', id, {
      companyId: ctx.companyId, branchId: ctx.branchId, oldStatus: job.status, newStatus: dto.status,
    });

    return updated;
  }

  async findByEntity(entityType: string, entityId: string, ctx: ActiveOperationalContext) {
    await this.labelsService.assertEntityInContext(entityType, entityId, ctx);
    const data = await this.prisma.barcodePrintJob.findMany({
      where: { ...this.tenantWhere(ctx), entityType, entityId, deletedAt: null },
      orderBy: { requestedAt: 'desc' },
    });
    return { data };
  }

  async getSummary(ctx: ActiveOperationalContext) {
    const tenant = { ...this.tenantWhere(ctx), deletedAt: null };
    const [total, pending, printing, completed, failed] = await Promise.all([
      this.prisma.barcodePrintJob.count({ where: tenant }),
      this.prisma.barcodePrintJob.count({ where: { ...tenant, status: 'PENDING' } }),
      this.prisma.barcodePrintJob.count({ where: { ...tenant, status: 'PRINTING' } }),
      this.prisma.barcodePrintJob.count({ where: { ...tenant, status: 'COMPLETED' } }),
      this.prisma.barcodePrintJob.count({ where: { ...tenant, status: 'FAILED' } }),
    ]);

    return { total, pending, printing, completed, failed };
  }
}
