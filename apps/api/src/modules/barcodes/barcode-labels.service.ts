import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateBarcodeLabelDto } from './dto/create-barcode-label.dto';
import { UpdateBarcodeLabelDto } from './dto/update-barcode-label.dto';
import { BarcodeLabelQueryDto } from './dto/barcode-label-query.dto';
import { GenerateBarcodeLabelDto } from './dto/generate-barcode-label.dto';

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
  ) {}

  private async validateEntity(entityType: string, entityId: string): Promise<void> {
    const modelMap: Record<string, any> = {
      MACHINE: this.prisma.machine,
      MACHINE_PART: this.prisma.machinePart,
      PRODUCT: this.prisma.product,
      WAREHOUSE: this.prisma.warehouse,
      WAREHOUSE_LOCATION: this.prisma.warehouseLocation,
      INVENTORY_COUNT: this.prisma.inventoryCount,
      INVENTORY_COUNT_LINE: this.prisma.inventoryCountLine,
      INVENTORY_MOVEMENT: this.prisma.inventoryMovement,
      INVENTORY_ADJUSTMENT: this.prisma.inventoryAdjustment,
      MAINTENANCE_REQUEST: this.prisma.maintenanceRequest,
      MAINTENANCE_TASK: this.prisma.maintenanceTask,
      MAINTENANCE_SCHEDULE: this.prisma.maintenanceSchedule,
      MAINTENANCE_CHECKLIST_ITEM: this.prisma.maintenanceChecklistItem,
      DOWNTIME_LOG: this.prisma.downtimeLog,
    };

    const model = modelMap[entityType];
    if (!model) throw new BadRequestException(`Unknown entity type: ${entityType}`);

    const entity = await model.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundException(`${entityType} with id ${entityId} not found`);
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

  async create(dto: CreateBarcodeLabelDto, userId: string) {
    await this.validateEntity(dto.entityType, dto.entityId);

    const existingActive = await this.prisma.barcodeLabel.findFirst({
      where: { entityType: dto.entityType, entityId: dto.entityId, status: 'ACTIVE', deletedAt: null },
    });

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'BARCODE_LABEL' } });
    if (!seq) throw new BadRequestException('Number sequence BARCODE_LABEL not configured');

    const label = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const code = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;
      const value = this.generateValue(dto.entityType, code);
      const symbology = dto.symbology || 'QR_CODE';

      return tx.barcodeLabel.create({
        data: {
          code,
          value,
          symbology,
          entityType: dto.entityType,
          entityId: dto.entityId,
          title: dto.title,
          description: dto.description,
          labelTemplateCode: dto.labelTemplateCode,
          createdById: userId,
        },
      });
    });

    const payload = this.buildQrPayload(label);
    await this.prisma.barcodeLabel.update({
      where: { id: label.id },
      data: { qrPayload: payload },
    });
    label.qrPayload = payload;

    await this.audit.log(userId, 'CREATE', 'BarcodeLabel', label.id, {
      entityType: label.entityType, entityId: label.entityId, code: label.code, value: label.value, symbology: label.symbology,
    });

    return label;
  }

  async generate(dto: GenerateBarcodeLabelDto, userId: string) {
    return this.create(
      {
        entityType: dto.entityType,
        entityId: dto.entityId,
        symbology: dto.symbology || 'QR_CODE',
        title: dto.title,
      },
      userId,
    );
  }

  async findAll(query: BarcodeLabelQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

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

  async findOne(id: string) {
    const label = await this.prisma.barcodeLabel.findUnique({ where: { id }, include: { scanEvents: { take: 10, orderBy: { scannedAt: 'desc' } } } });
    if (!label || label.deletedAt) throw new NotFoundException('Barcode label not found');
    return label;
  }

  async update(id: string, dto: UpdateBarcodeLabelDto, userId: string) {
    const label = await this.findOne(id);
    const updated = await this.prisma.barcodeLabel.update({ where: { id }, data: { ...dto, updatedById: userId } });
    await this.audit.log(userId, 'UPDATE', 'BarcodeLabel', id, { dto });
    return updated;
  }

  private async transitionStatus(id: string, status: string, action: string, userId: string) {
    const label = await this.findOne(id);
    const updated = await this.prisma.barcodeLabel.update({ where: { id }, data: { status, updatedById: userId } });
    await this.audit.log(userId, action, 'BarcodeLabel', id, { oldStatus: label.status, newStatus: status });
    return updated;
  }

  async activate(id: string, userId: string) {
    return this.transitionStatus(id, 'ACTIVE', 'ACTIVATE', userId);
  }

  async deactivate(id: string, userId: string) {
    return this.transitionStatus(id, 'INACTIVE', 'DEACTIVATE', userId);
  }

  async retire(id: string, userId: string) {
    return this.transitionStatus(id, 'RETIRED', 'RETIRE', userId);
  }

  async void(id: string, userId: string) {
    return this.transitionStatus(id, 'VOID', 'VOID', userId);
  }

  async markPrinted(id: string, userId: string) {
    const label = await this.findOne(id);
    const updated = await this.prisma.barcodeLabel.update({
      where: { id },
      data: { printCount: { increment: 1 }, lastPrintedAt: new Date(), updatedById: userId },
    });
    await this.audit.log(userId, 'PRINT', 'BarcodeLabel', id, { printCount: updated.printCount });
    return updated;
  }

  async findByEntity(entityType: string, entityId: string) {
    const labels = await this.prisma.barcodeLabel.findMany({
      where: { entityType, entityId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { data: labels };
  }

  async resolve(value: string) {
    const label = await this.prisma.barcodeLabel.findUnique({ where: { value } });
    if (!label || label.deletedAt) {
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

    const entity = await this.resolveEntity(label.entityType, label.entityId);
    return { found: true, result: 'SUCCESS', label, entity };
  }

  private async resolveEntity(entityType: string, entityId: string): Promise<any> {
    try {
      switch (entityType) {
        case 'MACHINE': {
          const m = await this.prisma.machine.findUnique({ where: { id: entityId }, include: { category: true } });
          if (!m) return null;
          return { type: 'MACHINE', id: m.id, code: m.code, name: m.name, status: m.status, category: m.category ? { id: m.category.id, name: m.category.name } : null };
        }
        case 'MACHINE_PART': {
          const p = await this.prisma.machinePart.findUnique({ where: { id: entityId }, include: { machine: true, product: true } });
          if (!p) return null;
          return { type: 'MACHINE_PART', id: p.id, code: p.code, name: p.name, partNumber: p.partNumber, quantity: p.quantity, unit: p.unit, machine: p.machine ? { id: p.machine.id, code: p.machine.code, name: p.machine.name } : null };
        }
        case 'PRODUCT': {
          const pr = await this.prisma.product.findUnique({ where: { id: entityId }, include: { category: true } });
          if (!pr) return null;
          return { type: 'PRODUCT', id: pr.id, code: pr.code, name: pr.name, unit: pr.unit, status: pr.status, category: pr.category ? { id: pr.category.id, name: pr.category.name } : null };
        }
        case 'WAREHOUSE': {
          const w = await this.prisma.warehouse.findUnique({ where: { id: entityId } });
          if (!w) return null;
          return { type: 'WAREHOUSE', id: w.id, code: w.code, name: w.name, status: w.status };
        }
        case 'WAREHOUSE_LOCATION': {
          const wl = await this.prisma.warehouseLocation.findUnique({ where: { id: entityId }, include: { warehouse: true } });
          if (!wl) return null;
          return { type: 'WAREHOUSE_LOCATION', id: wl.id, code: wl.code, name: wl.name, warehouse: wl.warehouse ? { id: wl.warehouse.id, code: wl.warehouse.code, name: wl.warehouse.name } : null };
        }
        case 'INVENTORY_COUNT': {
          const ic = await this.prisma.inventoryCount.findUnique({ where: { id: entityId } });
          if (!ic) return null;
          return { type: 'INVENTORY_COUNT', id: ic.id, countNumber: ic.countNumber, status: ic.status, countDate: ic.countDate };
        }
        case 'INVENTORY_COUNT_LINE': {
          const icl = await this.prisma.inventoryCountLine.findUnique({ where: { id: entityId }, include: { product: true, count: true } });
          if (!icl) return null;
          return { type: 'INVENTORY_COUNT_LINE', id: icl.id, countId: icl.countId, countNumber: icl.count?.countNumber, product: icl.product ? { id: icl.product.id, code: icl.product.code, name: icl.product.name } : null, systemQty: icl.systemQty, countedQty: icl.countedQty, differenceQty: icl.differenceQty, status: icl.status };
        }
        case 'MAINTENANCE_REQUEST': {
          const mr = await this.prisma.maintenanceRequest.findUnique({ where: { id: entityId }, include: { machine: true } });
          if (!mr) return null;
          return { type: 'MAINTENANCE_REQUEST', id: mr.id, requestNumber: mr.requestNumber, title: mr.title, status: mr.status, priority: mr.priority, machine: mr.machine ? { id: mr.machine.id, code: mr.machine.code, name: mr.machine.name } : null };
        }
        case 'MAINTENANCE_TASK': {
          const mt = await this.prisma.maintenanceTask.findUnique({ where: { id: entityId }, include: { request: { include: { machine: true } } } });
          if (!mt) return null;
          return { type: 'MAINTENANCE_TASK', id: mt.id, title: mt.title, status: mt.status, startedAt: mt.startedAt, completedAt: mt.completedAt, cancelledAt: mt.cancelledAt, request: mt.request ? { id: mt.request.id, requestNumber: mt.request.requestNumber, title: mt.request.title, machine: mt.request.machine ? { id: mt.request.machine.id, code: mt.request.machine.code, name: mt.request.machine.name } : null } : null };
        }
        case 'DOWNTIME_LOG': {
          const dl = await this.prisma.downtimeLog.findUnique({ where: { id: entityId }, include: { machine: true } });
          if (!dl) return null;
          return { type: 'DOWNTIME_LOG', id: dl.id, startTime: dl.startTime, endTime: dl.endTime, durationMinutes: dl.durationMinutes, reason: dl.reason, machine: dl.machine ? { id: dl.machine.id, code: dl.machine.code, name: dl.machine.name } : null };
        }
        case 'MAINTENANCE_SCHEDULE': {
          const ms = await this.prisma.maintenanceSchedule.findUnique({ where: { id: entityId }, include: { machine: true } });
          if (!ms) return null;
          return { type: 'MAINTENANCE_SCHEDULE', id: ms.id, title: ms.title, status: ms.status, frequency: ms.frequency, intervalDays: ms.intervalDays, startDate: ms.startDate, endDate: ms.endDate, machine: ms.machine ? { id: ms.machine.id, code: ms.machine.code, name: ms.machine.name } : null };
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
