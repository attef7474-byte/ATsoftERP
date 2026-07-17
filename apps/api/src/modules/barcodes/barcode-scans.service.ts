import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BarcodeLabelsService } from './barcode-labels.service';
import { ScanBarcodeDto } from './dto/scan-barcode.dto';
import { BarcodeScanQueryDto } from './dto/barcode-scan-query.dto';
import { ResolveScanDto } from './dto/resolve-scan.dto';
import { InventoryCountScanDto } from './dto/inventory-count-scan.dto';
import { MaintenanceScanDto } from './dto/maintenance-scan.dto';
import { MachineCheckScanDto } from './dto/machine-check-scan.dto';
import { PartLookupScanDto } from './dto/part-lookup-scan.dto';

@Injectable()
export class BarcodeScansService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private labelsService: BarcodeLabelsService,
  ) {}

  private async createScanEvent(params: {
    labelId?: string; scannedValue: string; symbology?: string; purpose: string;
    result: string; source: string; entityType?: string; entityId?: string;
    contextType?: string; contextId?: string; message?: string;
    scannedById?: string; ipAddress?: string; userAgent?: string;
  }) {
    return this.prisma.barcodeScanEvent.create({ data: params });
  }

  private async updateLabelScanStats(labelId: string) {
    await this.prisma.barcodeLabel.update({
      where: { id: labelId },
      data: { lastScannedAt: new Date(), scanCount: { increment: 1 } },
    });
  }

  private async recordScan(labelId: string | undefined, dto: { value: string; source?: string }, label: any, resultCode: string, purpose: string, message: string, extra: {
    contextType?: string; contextId?: string; entityType?: string; entityId?: string;
  }, userId?: string, ipAddress?: string, userAgent?: string) {
    const event = await this.createScanEvent({
      labelId,
      scannedValue: dto.value,
      symbology: label?.symbology,
      purpose,
      result: resultCode,
      source: dto.source || 'WEB',
      entityType: extra.entityType || label?.entityType,
      entityId: extra.entityId || label?.entityId,
      contextType: extra.contextType,
      contextId: extra.contextId,
      message,
      scannedById: userId,
      ipAddress,
      userAgent,
    });
    return event;
  }

  private buildSuggestedActions(entityType: string): string[] {
    switch (entityType) {
      case 'MACHINE': return ['OPEN_MACHINE', 'CREATE_MAINTENANCE_REQUEST', 'START_DOWNTIME', 'VIEW_TASKS', 'VIEW_MACHINE_PARTS'];
      case 'MACHINE_PART': return ['VIEW_BALANCE', 'ADD_TO_COUNT', 'CREATE_MAINTENANCE_TASK_NOTE', 'VIEW_USAGE_HISTORY'];
      case 'PRODUCT': return ['VIEW_BALANCE', 'ADD_TO_COUNT', 'VIEW_PRODUCT'];
      case 'WAREHOUSE': return ['VIEW_WAREHOUSE', 'VIEW_BALANCES'];
      case 'WAREHOUSE_LOCATION': return ['VIEW_LOCATION', 'VIEW_BALANCES', 'ADD_TO_COUNT'];
      case 'INVENTORY_COUNT': return ['OPEN_COUNT', 'VIEW_COUNT_LINES', 'CONTINUE_COUNTING'];
      case 'INVENTORY_COUNT_LINE': return ['COUNT_PRODUCT', 'VIEW_COUNT'];
      case 'MAINTENANCE_REQUEST': return ['OPEN_MAINTENANCE_REQUEST', 'VIEW_TASKS', 'START_REQUEST'];
      case 'MAINTENANCE_TASK': return ['OPEN_TASK', 'START_TASK', 'COMPLETE_TASK'];
      case 'DOWNTIME_LOG': return ['VIEW_DOWNTIME', 'CLOSE_DOWNTIME'];
      default: return [];
    }
  }

  async scan(dto: ScanBarcodeDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const resolution = await this.labelsService.resolve(dto.value);

    if (!resolution.found || !resolution.label) {
      const event = await this.recordScan(undefined, dto, null, 'NOT_FOUND', dto.purpose || 'GENERAL_LOOKUP', 'No matching barcode label found', {}, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN', 'BarcodeScanEvent', event.id, { scannedValue: dto.value, result: 'NOT_FOUND' });
      return { result: 'NOT_FOUND', message: 'Label not found', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const label = resolution.label;
    if (resolution.result !== 'SUCCESS') {
      const event = await this.recordScan(label.id, dto, label, resolution.result, dto.purpose || 'GENERAL_LOOKUP', `Label is ${label.status.toLowerCase()}`, {}, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN', 'BarcodeScanEvent', event.id, { result: resolution.result });
      return { result: resolution.result, message: `Label is ${label.status.toLowerCase()}`, label: { id: label.id, code: label.code, value: label.value, status: label.status }, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    await this.updateLabelScanStats(label.id);
    const entity = resolution.entity;
    const suggestedActions = entity ? this.buildSuggestedActions(entity.type) : [];

    const event = await this.recordScan(label.id, dto, label, 'SUCCESS', dto.purpose || 'GENERAL_LOOKUP', 'Scan successful', { contextType: dto.contextType, contextId: dto.contextId }, userId, ipAddress, userAgent);
    await this.audit.log(userId, 'SCAN', 'BarcodeScanEvent', event.id, { entityType: label.entityType, entityId: label.entityId, result: 'SUCCESS' });

    return { result: 'SUCCESS', message: 'Scan successful', label: { id: label.id, code: label.code, value: label.value, status: label.status, title: label.title }, entity, suggestedActions, event: { id: event.id, scannedAt: event.scannedAt } };
  }

  async findAllScans(query: BarcodeScanQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.purpose) where.purpose = query.purpose;
    if (query.result) where.result = query.result;
    if (query.scannedValue) where.scannedValue = { contains: query.scannedValue };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    const [data, total] = await Promise.all([
      this.prisma.barcodeScanEvent.findMany({ where, skip, take: limit, orderBy: { scannedAt: 'desc' } }),
      this.prisma.barcodeScanEvent.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findScanById(id: string) {
    const scan = await this.prisma.barcodeScanEvent.findUnique({ where: { id } });
    if (!scan) throw new NotFoundException('Scan event not found');
    return scan;
  }

  async scanInventoryCount(dto: InventoryCountScanDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const resolution = await this.labelsService.resolve(dto.value);

    if (!resolution.found || !resolution.label) {
      const event = await this.recordScan(undefined, dto, null, 'NOT_FOUND', 'INVENTORY_COUNTING', 'Product/location label not found', { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId }, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN_INVENTORY_COUNT', 'BarcodeScanEvent', event.id, { result: 'NOT_FOUND', inventoryCountId: dto.inventoryCountId });
      return { result: 'NOT_FOUND', message: 'Product/location label not found', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const label = resolution.label;
    if (resolution.result !== 'SUCCESS') {
      const event = await this.recordScan(label.id, dto, label, resolution.result, 'INVENTORY_COUNTING', `Label is ${label.status.toLowerCase()}`, { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId }, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN_INVENTORY_COUNT', 'BarcodeScanEvent', event.id, { result: resolution.result, inventoryCountId: dto.inventoryCountId });
      return { result: resolution.result, message: `Label is ${label.status.toLowerCase()}`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const { entityType, entityId } = label;
    if (!['PRODUCT', 'WAREHOUSE_LOCATION', 'WAREHOUSE', 'INVENTORY_COUNT', 'INVENTORY_COUNT_LINE'].includes(entityType)) {
      const event = await this.recordScan(label.id, dto, label, 'WRONG_CONTEXT', 'INVENTORY_COUNTING', `Cannot use ${entityType} label in inventory count context`, { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId, entityType, entityId }, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN_INVENTORY_COUNT', 'BarcodeScanEvent', event.id, { result: 'WRONG_CONTEXT', inventoryCountId: dto.inventoryCountId });
      return { result: 'WRONG_CONTEXT', message: `Cannot use ${entityType} label in inventory count context`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const count = await this.prisma.inventoryCount.findUnique({ where: { id: dto.inventoryCountId } });
    if (!count) throw new NotFoundException('Inventory count not found');
    if (count.status === 'COMPLETED' || count.status === 'CANCELLED') {
      const event = await this.recordScan(label.id, dto, label, 'VALIDATION_ERROR', 'INVENTORY_COUNTING', `Count is ${count.status.toLowerCase()}`, { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId, entityType, entityId }, userId, ipAddress, userAgent);
      await this.audit.log(userId, 'SCAN_INVENTORY_COUNT', 'BarcodeScanEvent', event.id, { result: 'VALIDATION_ERROR', inventoryCountId: dto.inventoryCountId });
      return { result: 'VALIDATION_ERROR', message: `Cannot scan into a ${count.status.toLowerCase()} count`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    let countLine: any = null;
    let productInfo: any = null;

    if (entityType === 'PRODUCT') {
      const product = await this.prisma.product.findUnique({ where: { id: entityId } });
      if (!product) {
        const event = await this.recordScan(label.id, dto, label, 'NOT_FOUND', 'INVENTORY_COUNTING', 'Product not found', { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId, entityType, entityId }, userId, ipAddress, userAgent);
        return { result: 'NOT_FOUND', message: 'Product not found', event: { id: event.id, scannedAt: event.scannedAt } };
      }

      const locationId = dto.locationId || undefined;
      productInfo = { id: product.id, code: product.code, name: product.name, unit: product.unit };

      const existingLine = await this.prisma.inventoryCountLine.findFirst({
        where: { countId: dto.inventoryCountId, productId: entityId, warehouseLocationId: locationId ?? null, deletedAt: null },
      });

      if (dto.countedQty !== undefined) {
        if (existingLine?.status === 'VERIFIED') {
          const event = await this.recordScan(label.id, dto, label, 'VALIDATION_ERROR', 'INVENTORY_COUNTING', 'Count line is already verified', { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId, entityType, entityId }, userId, ipAddress, userAgent);
          return { result: 'VALIDATION_ERROR', message: 'Count line is already verified, cannot update', event: { id: event.id, scannedAt: event.scannedAt } };
        }
        const data: any = {
          countedQty: dto.countedQty,
          differenceQty: (existingLine?.systemQty || 0) - dto.countedQty,
          status: 'COUNTED', countedAt: new Date(), countedById: userId,
        };
        if (existingLine) {
          countLine = await this.prisma.inventoryCountLine.update({ where: { id: existingLine.id }, data, include: { product: true } });
        } else {
          countLine = await this.prisma.inventoryCountLine.create({
            data: {
              countId: dto.inventoryCountId, productId: entityId,
              warehouseLocationId: locationId, systemQty: 0,
              countedQty: dto.countedQty, differenceQty: -dto.countedQty,
              status: 'COUNTED', countedAt: new Date(), countedById: userId,
            },
            include: { product: true },
          });
        }
      } else if (existingLine) {
        countLine = existingLine;
      }
    }

    if (entityType === 'INVENTORY_COUNT_LINE') {
      countLine = await this.prisma.inventoryCountLine.findUnique({ where: { id: entityId }, include: { product: true } });
      if (countLine) {
        productInfo = countLine.product ? { id: countLine.product.id, code: countLine.product.code, name: countLine.product.name, unit: countLine.product.unit } : null;
      }
    }

    await this.updateLabelScanStats(label.id);
    const event = await this.recordScan(label.id, dto, label, 'SUCCESS', 'INVENTORY_COUNTING', 'Inventory count scan processed', { contextType: 'INVENTORY_COUNT', contextId: dto.inventoryCountId, entityType, entityId }, userId, ipAddress, userAgent);
    await this.audit.log(userId, 'SCAN_INVENTORY_COUNT', 'BarcodeScanEvent', event.id, { result: 'SUCCESS', inventoryCountId: dto.inventoryCountId });

    return {
      result: 'SUCCESS', message: 'Inventory count scan processed',
      entityType, product: productInfo,
      countLine: countLine ? { id: countLine.id, systemQty: countLine.systemQty, countedQty: countLine.countedQty, differenceQty: countLine.differenceQty, status: countLine.status } : null,
      countStatus: count.status,
      event: { id: event.id, scannedAt: event.scannedAt },
    };
  }

  async scanMaintenance(dto: MaintenanceScanDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const resolution = await this.labelsService.resolve(dto.value);

    if (!resolution.found || !resolution.label) {
      const event = await this.recordScan(undefined, dto, null, 'NOT_FOUND', dto.purpose || 'MAINTENANCE_LOOKUP', 'Label not found', { contextType: 'MAINTENANCE', contextId: dto.maintenanceRequestId || dto.maintenanceTaskId }, userId, ipAddress, userAgent);
      return { result: 'NOT_FOUND', message: 'Label not found', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const label = resolution.label;
    if (resolution.result !== 'SUCCESS') {
      const event = await this.recordScan(label.id, dto, label, resolution.result, dto.purpose || 'MAINTENANCE_LOOKUP', `Label is ${label.status.toLowerCase()}`, { contextType: 'MAINTENANCE', contextId: dto.maintenanceRequestId || dto.maintenanceTaskId }, userId, ipAddress, userAgent);
      return { result: resolution.result, message: `Label is ${label.status.toLowerCase()}`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const { entityType } = label;
    if (!['MACHINE', 'MACHINE_PART', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'DOWNTIME_LOG'].includes(entityType)) {
      const event = await this.recordScan(label.id, dto, label, 'WRONG_CONTEXT', dto.purpose || 'MAINTENANCE_LOOKUP', `Cannot use ${entityType} label in maintenance context`, { contextType: 'MAINTENANCE', contextId: dto.maintenanceRequestId || dto.maintenanceTaskId, entityType, entityId: label.entityId }, userId, ipAddress, userAgent);
      return { result: 'WRONG_CONTEXT', message: `Cannot use ${entityType} label in maintenance context`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    await this.updateLabelScanStats(label.id);
    const entity = resolution.entity;
    const suggestedActions = entity ? this.buildSuggestedActions(entityType) : [];

    const event = await this.recordScan(label.id, dto, label, 'SUCCESS', dto.purpose || 'MAINTENANCE_LOOKUP', 'Maintenance scan processed', { contextType: 'MAINTENANCE', contextId: dto.maintenanceRequestId || dto.maintenanceTaskId, entityType, entityId: label.entityId }, userId, ipAddress, userAgent);
    await this.audit.log(userId, 'SCAN_MAINTENANCE', 'BarcodeScanEvent', event.id, { result: 'SUCCESS' });

    return { result: 'SUCCESS', message: 'Maintenance scan processed', entityType, entity, suggestedActions, event: { id: event.id, scannedAt: event.scannedAt } };
  }

  async scanMachineCheck(dto: MachineCheckScanDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const resolution = await this.labelsService.resolve(dto.value);

    if (!resolution.found || !resolution.label) {
      const event = await this.recordScan(undefined, dto, null, 'NOT_FOUND', 'MACHINE_CHECK', 'Machine label not found', {}, userId, ipAddress, userAgent);
      return { result: 'NOT_FOUND', message: 'Machine label not found', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const label = resolution.label;
    if (resolution.result !== 'SUCCESS') {
      const event = await this.recordScan(label.id, dto, label, resolution.result, 'MACHINE_CHECK', `Label is ${label.status.toLowerCase()}`, {}, userId, ipAddress, userAgent);
      return { result: resolution.result, message: `Label is ${label.status.toLowerCase()}`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    if (label.entityType !== 'MACHINE') {
      const event = await this.recordScan(label.id, dto, label, 'WRONG_CONTEXT', 'MACHINE_CHECK', 'Label is not a machine', { entityType: label.entityType, entityId: label.entityId }, userId, ipAddress, userAgent);
      return { result: 'WRONG_CONTEXT', message: 'Label is not a machine', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    await this.updateLabelScanStats(label.id);
    const machineId = label.entityId;
    const machine = resolution.entity;
    let activeRequests = 0;
    let openTasks = 0;
    let activeDowntime = 0;
    let totalDowntimeThisMonth = 0;

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      activeRequests = await this.prisma.maintenanceRequest.count({ where: { machineId, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null } });
      openTasks = await this.prisma.maintenanceTask.count({ where: { request: { machineId }, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
      activeDowntime = await this.prisma.downtimeLog.count({ where: { machineId, endTime: null, cancelledAt: null } });
      const monthDowntime = await this.prisma.downtimeLog.aggregate({ where: { machineId, startTime: { gte: startOfMonth }, cancelledAt: null }, _sum: { durationMinutes: true } });
      totalDowntimeThisMonth = (monthDowntime._sum.durationMinutes || 0) / 60;
    } catch { }

    const event = await this.recordScan(label.id, dto, label, 'SUCCESS', 'MACHINE_CHECK', 'Machine check completed', { entityType: 'MACHINE', entityId: machineId }, userId, ipAddress, userAgent);
    await this.audit.log(userId, 'SCAN_MACHINE_CHECK', 'BarcodeScanEvent', event.id, { result: 'SUCCESS' });

    return {
      result: 'SUCCESS', message: 'Machine check completed',
      machine,
      operationalSummary: { activeRequests, openTasks, activeDowntime, totalDowntimeHoursThisMonth: Math.round(totalDowntimeThisMonth * 100) / 100 },
      suggestedActions: ['CREATE_MAINTENANCE_REQUEST', 'START_DOWNTIME', 'VIEW_TASKS', 'VIEW_MACHINE_PARTS'],
      event: { id: event.id, scannedAt: event.scannedAt },
    };
  }

  async scanPartLookup(dto: PartLookupScanDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const resolution = await this.labelsService.resolve(dto.value);

    if (!resolution.found || !resolution.label) {
      const event = await this.recordScan(undefined, dto, null, 'NOT_FOUND', 'PART_LOOKUP', 'Part/product label not found', {}, userId, ipAddress, userAgent);
      return { result: 'NOT_FOUND', message: 'Part/product label not found', event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const label = resolution.label;
    if (resolution.result !== 'SUCCESS') {
      const event = await this.recordScan(label.id, dto, label, resolution.result, 'PART_LOOKUP', `Label is ${label.status.toLowerCase()}`, {}, userId, ipAddress, userAgent);
      return { result: resolution.result, message: `Label is ${label.status.toLowerCase()}`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    const { entityType, entityId } = label;
    if (!['MACHINE_PART', 'PRODUCT'].includes(entityType)) {
      const event = await this.recordScan(label.id, dto, label, 'WRONG_CONTEXT', 'PART_LOOKUP', `Cannot use ${entityType} label in part lookup`, { entityType, entityId }, userId, ipAddress, userAgent);
      return { result: 'WRONG_CONTEXT', message: `Cannot use ${entityType} label in part lookup`, event: { id: event.id, scannedAt: event.scannedAt } };
    }

    await this.updateLabelScanStats(label.id);
    let balances: any[] = [];

    if (entityType === 'PRODUCT') {
      balances = await this.prisma.inventoryBalance.findMany({ where: { productId: entityId }, include: { warehouse: true, location: true }, take: 20 });
    } else if (entityType === 'MACHINE_PART') {
      const part = await this.prisma.machinePart.findUnique({ where: { id: entityId } });
      if (part?.productId) {
        balances = await this.prisma.inventoryBalance.findMany({ where: { productId: part.productId }, include: { warehouse: true, location: true }, take: 20 });
      }
    }

    const event = await this.recordScan(label.id, dto, label, 'SUCCESS', 'PART_LOOKUP', 'Part lookup completed', { entityType, entityId }, userId, ipAddress, userAgent);
    await this.audit.log(userId, 'SCAN_PART_LOOKUP', 'BarcodeScanEvent', event.id, { result: 'SUCCESS' });

    return {
      result: 'SUCCESS', message: 'Part lookup completed',
      part: resolution.entity,
      balances: balances.map((b: any) => ({
        id: b.id, quantity: b.quantity,
        warehouse: b.warehouse ? { id: b.warehouse.id, code: b.warehouse.code, name: b.warehouse.name } : null,
        location: b.location ? { id: b.location.id, code: b.location.code, name: b.location.name } : null,
      })),
      suggestedActions: ['VIEW_BALANCE', 'ADD_TO_COUNT'],
      event: { id: event.id, scannedAt: event.scannedAt },
    };
  }

  async getScanSummary() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalScans, todayScans, weekScans, monthScans, resultCounts] = await Promise.all([
      this.prisma.barcodeScanEvent.count(),
      this.prisma.barcodeScanEvent.count({ where: { scannedAt: { gte: startOfDay } } }),
      this.prisma.barcodeScanEvent.count({ where: { scannedAt: { gte: startOfWeek } } }),
      this.prisma.barcodeScanEvent.count({ where: { scannedAt: { gte: startOfMonth } } }),
      this.prisma.barcodeScanEvent.groupBy({
        by: ['result'],
        _count: true,
      }),
    ]);

    return {
      totalScans,
      todayScans,
      weekScans,
      monthScans,
      resultBreakdown: resultCounts.map((r: any) => ({ result: r.result, count: r._count })),
    };
  }

  async findScansByEntity(entityType: string, entityId: string, query: BarcodeScanQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { entityType, entityId };

    if (query.purpose) where.purpose = query.purpose;
    if (query.result) where.result = query.result;

    const [data, total] = await Promise.all([
      this.prisma.barcodeScanEvent.findMany({ where, skip, take: limit, orderBy: { scannedAt: 'desc' } }),
      this.prisma.barcodeScanEvent.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async resolveAndScan(dto: ResolveScanDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const scanDto = new ScanBarcodeDto();
    scanDto.value = dto.value;
    scanDto.purpose = dto.purpose || 'GENERAL_LOOKUP';
    return this.scan(scanDto, userId, ipAddress, userAgent);
  }
}
