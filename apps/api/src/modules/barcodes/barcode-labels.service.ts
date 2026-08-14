import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../modules/numbering/numbering.service';
import { CreateBarcodeLabelDto } from './dto/create-barcode-label.dto';
import { UpdateBarcodeLabelDto } from './dto/update-barcode-label.dto';
import { BarcodeLabelQueryDto } from './dto/barcode-label-query.dto';
import { GenerateBarcodeLabelDto } from './dto/generate-barcode-label.dto';
import { GenerateQRDto } from './dto/generate-qr.dto';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

const ENTITY_PREFIXES: Record<string, string> = {
  MACHINE: 'MCH',
  MACHINE_PART: 'MPT',
  PRODUCT: 'PRD',
  WAREHOUSE: 'WRH',
  WAREHOUSE_LOCATION: 'WRL',
  INVENTORY_COUNT: 'ICT',
  INVENTORY_COUNT_LINE: 'ICL',
  INVENTORY_MOVEMENT: 'IMV',
  INVENTORY_ADJUSTMENT: 'IAD',
  MAINTENANCE_REQUEST: 'MRQ',
  MAINTENANCE_TASK: 'MTK',
  MAINTENANCE_SCHEDULE: 'MSH',
  MAINTENANCE_CHECKLIST_ITEM: 'MCL',
  DOWNTIME_LOG: 'DTL',
};

@Injectable()
export class BarcodeLabelsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private tenantWhere(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  private invalidReference(entityType: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'barcodes.invalidEntityReference',
      message: `Invalid or inaccessible ${entityType} reference`,
    });
  }

  /**
   * Verifies the actual referenced aggregate, not merely the polymorphic id.
   * Product is approved global reference data. Machine-owned aggregates accept
   * a company-wide machine (branchId NULL) or the current branch; barcode facts
   * themselves are always persisted to the exact active branch.
   */
  async assertEntityInContext(entityType: string, entityId: string, ctx: ActiveOperationalContext): Promise<any> {
    const machineScope = {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
      deletedAt: null,
    };
    const warehouseScope = {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
      deletedAt: null,
    };
    let entity: any = null;

    switch (entityType) {
      case 'MACHINE':
        entity = await this.prisma.machine.findFirst({ where: { id: entityId, ...machineScope }, include: { category: true } });
        break;
      case 'MACHINE_PART':
        entity = await this.prisma.machinePart.findFirst({
          where: { id: entityId, machine: machineScope },
          include: { machine: true, product: true },
        });
        break;
      case 'PRODUCT':
        // Product is intentionally global reference data; the label remains
        // tenant-owned by the active context that creates it.
        entity = await this.prisma.product.findFirst({ where: { id: entityId, deletedAt: null }, include: { category: true } });
        break;
      case 'WAREHOUSE':
        entity = await this.prisma.warehouse.findFirst({ where: { id: entityId, ...warehouseScope } });
        break;
      case 'WAREHOUSE_LOCATION':
        entity = await this.prisma.warehouseLocation.findFirst({
          where: { id: entityId, warehouse: warehouseScope },
          include: { warehouse: true },
        });
        break;
      case 'INVENTORY_COUNT':
        entity = await this.prisma.inventoryCount.findFirst({
          where: { id: entityId, ...this.tenantWhere(ctx), deletedAt: null },
        });
        break;
      case 'INVENTORY_COUNT_LINE':
        entity = await this.prisma.inventoryCountLine.findFirst({
          where: { id: entityId, deletedAt: null, count: { ...this.tenantWhere(ctx), deletedAt: null } },
          include: { product: true, count: true },
        });
        break;
      case 'INVENTORY_MOVEMENT':
        entity = await this.prisma.inventoryMovement.findFirst({
          where: { id: entityId, ...this.tenantWhere(ctx), deletedAt: null },
        });
        break;
      case 'INVENTORY_ADJUSTMENT':
        entity = await this.prisma.inventoryAdjustment.findFirst({
          where: { id: entityId, ...this.tenantWhere(ctx), deletedAt: null },
        });
        break;
      case 'MAINTENANCE_REQUEST':
        entity = await this.prisma.maintenanceRequest.findFirst({
          where: { id: entityId, deletedAt: null, machine: machineScope },
          include: { machine: true },
        });
        break;
      case 'MAINTENANCE_TASK':
        entity = await this.prisma.maintenanceTask.findFirst({
          where: { id: entityId, request: { deletedAt: null, machine: machineScope } },
          include: { request: { include: { machine: true } } },
        });
        break;
      case 'MAINTENANCE_SCHEDULE':
        entity = await this.prisma.maintenanceSchedule.findFirst({
          where: { id: entityId, machine: machineScope },
          include: { machine: true },
        });
        break;
      case 'MAINTENANCE_CHECKLIST_ITEM':
        entity = await this.prisma.maintenanceChecklistItem.findFirst({
          where: { id: entityId, schedule: { machine: machineScope } },
          include: { schedule: { include: { machine: true } } },
        });
        break;
      case 'DOWNTIME_LOG':
        entity = await this.prisma.downtimeLog.findFirst({
          where: { id: entityId, machine: machineScope },
          include: { machine: true },
        });
        break;
      default:
        throw new BadRequestException({ messageKey: 'barcodes.unsupportedEntityType', message: `Unsupported entity type: ${entityType}` });
    }

    if (!entity) throw this.invalidReference(entityType);
    return entity;
  }

  private async assertGlobalTemplateCode(labelTemplateCode?: string): Promise<void> {
    if (!labelTemplateCode) return;
    const template = await this.prisma.barcodeLabelTemplate.findFirst({
      where: { code: labelTemplateCode, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!template) {
      throw new BadRequestException({ messageKey: 'barcodes.invalidTemplateReference', message: 'Invalid barcode template' });
    }
  }

  private generateValue(entityType: string, code: string): string {
    const prefix = ENTITY_PREFIXES[entityType] || 'GEN';
    return `AT-${prefix}-${code}`;
  }

  private buildQrPayload(label: any): string {
    return JSON.stringify({
      app: 'ATsoftERP',
      version: 1,
      entityType: label.entityType,
      entityId: label.entityId,
      labelCode: label.code,
      value: label.value,
    });
  }

  async create(dto: CreateBarcodeLabelDto, userId: string, ctx: ActiveOperationalContext) {
    await this.assertEntityInContext(dto.entityType, dto.entityId, ctx);
    await this.assertGlobalTemplateCode(dto.labelTemplateCode);

    const label = await this.prisma.$transaction(async (tx) => {
      const code = await this.numberingService.generateNumberAtomic('BARCODE_LABEL');
      const value = this.generateValue(dto.entityType, code);
      const symbology = dto.symbology || 'QR_CODE';

      return tx.barcodeLabel.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code,
          value,
          symbology,
          entityType: dto.entityType,
          entityId: dto.entityId,
          title: dto.title,
          description: dto.description,
          labelTemplateCode: dto.labelTemplateCode,
          createdById: userId,
        } as any,
      });
    });

    const payload = this.buildQrPayload(label);
    await this.prisma.barcodeLabel.update({
      where: { id: label.id },
      data: { qrPayload: payload },
    });
    label.qrPayload = payload;

    await this.audit.log(userId, 'CREATE', 'BarcodeLabel', label.id, {
      companyId: ctx.companyId, branchId: ctx.branchId,
      entityType: label.entityType, entityId: label.entityId, code: label.code, value: label.value, symbology: label.symbology,
    });

    return label;
  }

  async generate(dto: GenerateBarcodeLabelDto, userId: string, ctx: ActiveOperationalContext) {
    return this.create(
      {
        entityType: dto.entityType,
        entityId: dto.entityId,
        symbology: dto.symbology || 'QR_CODE',
        title: dto.title,
      },
      userId,
      ctx,
    );
  }

  async findAll(query: BarcodeLabelQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { ...this.tenantWhere(ctx), deletedAt: null };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { value: { contains: query.search } },
        { title: { contains: query.search } },
        { entityId: query.search },
      ];
    }
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.status) where.status = query.status;
    if (query.symbology) where.symbology = query.symbology;

    const [data, total] = await Promise.all([
      this.prisma.barcodeLabel.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.barcodeLabel.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const label = await this.prisma.barcodeLabel.findFirst({
      where: { id, ...this.tenantWhere(ctx), deletedAt: null },
      include: {
        scanEvents: {
          where: this.tenantWhere(ctx),
          take: 10,
          orderBy: { scannedAt: 'desc' },
        },
      },
    });
    if (!label) throw new NotFoundException('Barcode label not found');
    try {
      await this.assertEntityInContext(label.entityType, label.entityId, ctx);
    } catch (error) {
      if (error instanceof BadRequestException) throw new NotFoundException('Barcode label not found');
      throw error;
    }
    return label;
  }

  async update(id: string, dto: UpdateBarcodeLabelDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    const updated = await this.prisma.barcodeLabel.update({ where: { id }, data: { ...dto, updatedById: userId } });
    await this.audit.log(userId, 'UPDATE', 'BarcodeLabel', id, { companyId: ctx.companyId, branchId: ctx.branchId, dto });
    return updated;
  }

  private async transitionStatus(id: string, status: string, action: string, userId: string, ctx: ActiveOperationalContext) {
    const label = await this.findOne(id, ctx);
    const updated = await this.prisma.barcodeLabel.update({ where: { id }, data: { status, updatedById: userId } });
    await this.audit.log(userId, action, 'BarcodeLabel', id, {
      companyId: ctx.companyId, branchId: ctx.branchId, oldStatus: label.status, newStatus: status,
    });
    return updated;
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transitionStatus(id, 'ACTIVE', 'ACTIVATE', userId, ctx);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transitionStatus(id, 'INACTIVE', 'DEACTIVATE', userId, ctx);
  }

  async retire(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transitionStatus(id, 'RETIRED', 'RETIRE', userId, ctx);
  }

  async void(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.transitionStatus(id, 'VOID', 'VOID', userId, ctx);
  }

  async markPrinted(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    const updated = await this.prisma.barcodeLabel.update({
      where: { id },
      data: { printCount: { increment: 1 }, lastPrintedAt: new Date(), updatedById: userId },
    });
    await this.audit.log(userId, 'PRINT', 'BarcodeLabel', id, {
      companyId: ctx.companyId, branchId: ctx.branchId, printCount: updated.printCount,
    });
    return updated;
  }

  async findByEntity(entityType: string, entityId: string, ctx: ActiveOperationalContext) {
    await this.assertEntityInContext(entityType, entityId, ctx);
    const labels = await this.prisma.barcodeLabel.findMany({
      where: { ...this.tenantWhere(ctx), entityType, entityId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { data: labels };
  }

  async resolve(value: string, ctx: ActiveOperationalContext) {
    const label = await this.prisma.barcodeLabel.findFirst({
      where: { value, ...this.tenantWhere(ctx), deletedAt: null },
    });
    if (!label) {
      return { found: false, result: 'NOT_FOUND', label: null, entity: null };
    }
    if (label.status === 'INACTIVE') {
      return { found: true, result: 'INACTIVE_LABEL', label, entity: null };
    }
    if (label.status === 'RETIRED') {
      return { found: true, result: 'RETIRED_LABEL', label, entity: null };
    }
    if (label.status === 'VOID') {
      return { found: true, result: 'VOID_LABEL', label, entity: null };
    }

    let entity: any;
    try {
      entity = await this.resolveEntity(label.entityType, label.entityId, ctx);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return { found: false, result: 'NOT_FOUND', label: null, entity: null };
      }
      throw error;
    }
    return { found: true, result: 'SUCCESS', label, entity };
  }

  async softDelete(id: string, userId: string, ctx: ActiveOperationalContext) {
    const label = await this.findOne(id, ctx);
    const updated = await this.prisma.barcodeLabel.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });
    await this.audit.log(userId, 'DELETE', 'BarcodeLabel', id, {
      companyId: ctx.companyId, branchId: ctx.branchId, code: label.code, value: label.value,
    });
    return updated;
  }

  async preview(id: string, ctx: ActiveOperationalContext) {
    const label = await this.findOne(id, ctx);
    const entity = await this.resolveEntity(label.entityType, label.entityId, ctx);
    return {
      ...label,
      preview: {
        value: label.value,
        qrPayload: label.qrPayload ? JSON.parse(label.qrPayload) : null,
        entity,
        labelUrl: `/barcodes/labels/${label.id}`,
      },
    };
  }

  async download(id: string, ctx: ActiveOperationalContext) {
    const label = await this.findOne(id, ctx);
    const entity = await this.resolveEntity(label.entityType, label.entityId, ctx);
    return {
      filename: `${label.code}.json`,
      contentType: 'application/json',
      data: {
        app: 'ATsoftERP',
        version: 1,
        label: {
          id: label.id,
          code: label.code,
          value: label.value,
          symbology: label.symbology,
          title: label.title,
          description: label.description,
          entityType: label.entityType,
          entityId: label.entityId,
          qrPayload: label.qrPayload ? JSON.parse(label.qrPayload) : null,
          status: label.status,
          createdAt: label.createdAt,
        },
        entity,
      },
    };
  }

  async generateQR(dto: GenerateQRDto, userId: string, ctx: ActiveOperationalContext) {
    return this.generate(
      {
        entityType: dto.entityType,
        entityId: dto.entityId,
        symbology: 'QR_CODE',
        title: dto.title,
      },
      userId,
      ctx,
    );
  }

  private async resolveEntity(entityType: string, entityId: string, ctx: ActiveOperationalContext): Promise<any> {
    const entity = await this.assertEntityInContext(entityType, entityId, ctx);
    switch (entityType) {
        case 'MACHINE': {
          const m = entity;
          return { type: 'MACHINE', id: m.id, code: m.code, name: m.name, status: m.status, category: m.category ? { id: m.category.id, name: m.category.name } : null };
        }
        case 'MACHINE_PART': {
          const p = entity;
          return { type: 'MACHINE_PART', id: p.id, code: p.code, name: p.name, partNumber: p.partNumber, quantity: p.quantity, unit: p.unit, machine: p.machine ? { id: p.machine.id, code: p.machine.code, name: p.machine.name } : null };
        }
        case 'PRODUCT': {
          const pr = entity;
          return { type: 'PRODUCT', id: pr.id, code: pr.code, name: pr.name, unit: pr.unit, status: pr.status, category: pr.category ? { id: pr.category.id, name: pr.category.name } : null };
        }
        case 'WAREHOUSE': {
          const w = entity;
          return { type: 'WAREHOUSE', id: w.id, code: w.code, name: w.name, status: w.status };
        }
        case 'WAREHOUSE_LOCATION': {
          const wl = entity;
          return { type: 'WAREHOUSE_LOCATION', id: wl.id, code: wl.code, name: wl.name, warehouse: wl.warehouse ? { id: wl.warehouse.id, code: wl.warehouse.code, name: wl.warehouse.name } : null };
        }
        case 'INVENTORY_COUNT': {
          const ic = entity;
          return { type: 'INVENTORY_COUNT', id: ic.id, countNumber: ic.countNumber, status: ic.status, countDate: ic.countDate };
        }
        case 'INVENTORY_COUNT_LINE': {
          const icl = entity;
          return { type: 'INVENTORY_COUNT_LINE', id: icl.id, countId: icl.countId, countNumber: icl.count?.countNumber, product: icl.product ? { id: icl.product.id, code: icl.product.code, name: icl.product.name } : null, systemQty: icl.systemQty, countedQty: icl.countedQty, differenceQty: icl.differenceQty, status: icl.status };
        }
        case 'INVENTORY_MOVEMENT':
          return { type: entityType, id: entity.id, movementNumber: entity.movementNumber, status: entity.status, movementDate: entity.movementDate };
        case 'INVENTORY_ADJUSTMENT':
          return { type: entityType, id: entity.id, adjustmentNumber: entity.adjustmentNumber, status: entity.status, adjustmentDate: entity.adjustmentDate };
        case 'MAINTENANCE_REQUEST': {
          const mr = entity;
          return { type: 'MAINTENANCE_REQUEST', id: mr.id, requestNumber: mr.requestNumber, title: mr.title, status: mr.status, priority: mr.priority, machine: mr.machine ? { id: mr.machine.id, code: mr.machine.code, name: mr.machine.name } : null };
        }
        case 'MAINTENANCE_TASK': {
          const mt = entity;
          return { type: 'MAINTENANCE_TASK', id: mt.id, title: mt.title, status: mt.status, startedAt: mt.startedAt, completedAt: mt.completedAt, cancelledAt: mt.cancelledAt, request: mt.request ? { id: mt.request.id, requestNumber: mt.request.requestNumber, title: mt.request.title, machine: mt.request.machine ? { id: mt.request.machine.id, code: mt.request.machine.code, name: mt.request.machine.name } : null } : null };
        }
        case 'DOWNTIME_LOG': {
          const dl = entity;
          return { type: 'DOWNTIME_LOG', id: dl.id, startTime: dl.startTime, endTime: dl.endTime, durationMinutes: dl.durationMinutes, reason: dl.reason, machine: dl.machine ? { id: dl.machine.id, code: dl.machine.code, name: dl.machine.name } : null };
        }
        case 'MAINTENANCE_SCHEDULE': {
          const ms = entity;
          return { type: 'MAINTENANCE_SCHEDULE', id: ms.id, title: ms.title, status: ms.status, frequency: ms.frequency, intervalDays: ms.intervalDays, startDate: ms.startDate, endDate: ms.endDate, machine: ms.machine ? { id: ms.machine.id, code: ms.machine.code, name: ms.machine.name } : null };
        }
        case 'MAINTENANCE_CHECKLIST_ITEM':
          return { type: entityType, id: entity.id, title: entity.title, scheduleId: entity.scheduleId };
        default:
          throw new BadRequestException({ messageKey: 'barcodes.unsupportedEntityType' });
    }
  }
}
