import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { QueryInstalledPartDto, QueryReplacementHistoryDto } from './dto/installed-parts-replacement.dto';

@Injectable()
export class InstalledPartsReplacementService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private audit: AuditService,
  ) {}

  async recordInstalledPartInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      sparePartId: string;
      productId?: string | null;
      maintenanceRequestId: string;
      requiredPartId: string;
      inventoryMovementId: string;
      conditionMovementId?: string | null;
      installedQuantity: number;
      installedCondition: string;
      installedByUserId: string;
      sourceType?: string;
      sourceId?: string;
      serialNumber?: string | null;
      batchNumber?: string | null;
      notes?: string | null;
    },
  ) {
    return tx.machineInstalledPart.create({
      data: {
        machineId: data.machineId,
        machineComponentId: data.machineComponentId || null,
        sparePartId: data.sparePartId,
        productId: data.productId || null,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        inventoryMovementId: data.inventoryMovementId,
        conditionMovementId: data.conditionMovementId || null,
        installedQuantity: data.installedQuantity,
        installedCondition: data.installedCondition || 'NEW',
        installedAt: new Date(),
        installedByUserId: data.installedByUserId,
        sourceType: data.sourceType || 'MAINTENANCE_ISSUE',
        sourceId: data.sourceId || data.requiredPartId,
        serialNumber: data.serialNumber || null,
        batchNumber: data.batchNumber || null,
        status: 'ACTIVE',
        notes: data.notes || null,
      },
    });
  }

  async recordReplacementInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      maintenanceRequestId: string;
      requiredPartId: string;
      newInstalledPartId: string;
      oldInstalledPartId?: string | null;
      oldSparePartId?: string | null;
      newSparePartId: string;
      issuedCondition: string;
      issuedQuantity: number;
      removedCondition?: string | null;
      removedQuantity?: number | null;
      replacementAction: string;
      noReturnReason?: string | null;
      removedReturnedToStock?: boolean;
      conditionOutMovementId?: string | null;
      conditionInMovementId?: string | null;
      inventoryOutMovementId: string;
      replacedByUserId: string;
      notes?: string | null;
    },
  ) {
    const replacementNumber = await this.numberingService.generateNumberAtomic('SPARE_PART_REPLACEMENT');

    return tx.sparePartReplacementHistory.create({
      data: {
        replacementNumber,
        machineId: data.machineId,
        machineComponentId: data.machineComponentId || null,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        newInstalledPartId: data.newInstalledPartId,
        oldInstalledPartId: data.oldInstalledPartId || null,
        oldSparePartId: data.oldSparePartId || null,
        newSparePartId: data.newSparePartId,
        issuedCondition: data.issuedCondition,
        issuedQuantity: data.issuedQuantity,
        removedCondition: data.removedCondition || null,
        removedQuantity: data.removedQuantity || null,
        replacementAction: data.replacementAction,
        noReturnReason: data.noReturnReason || null,
        removedReturnedToStock: data.removedReturnedToStock || false,
        conditionOutMovementId: data.conditionOutMovementId || null,
        conditionInMovementId: data.conditionInMovementId || null,
        inventoryOutMovementId: data.inventoryOutMovementId,
        replacedAt: new Date(),
        replacedByUserId: data.replacedByUserId,
        notes: data.notes || null,
      },
    });
  }

  async markInstalledPartRemovedInTx(
    tx: any,
    installedPartId: string,
    data: {
      removedAt?: Date;
      removedByUserId: string;
      removedCondition?: string | null;
      removedQuantity?: number | null;
      removedReason?: string | null;
      newStatus?: string;
    },
  ) {
    return tx.machineInstalledPart.update({
      where: { id: installedPartId },
      data: {
        status: data.newStatus || 'REMOVED',
        removedAt: data.removedAt || new Date(),
        removedByUserId: data.removedByUserId,
        removedCondition: data.removedCondition || null,
        removedQuantity: data.removedQuantity || null,
        removedReason: data.removedReason || null,
      },
    });
  }

  async getInstalledParts(query: QueryInstalledPartDto) {
    const where: any = {};
    if (query.machineId) where.machineId = query.machineId;
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.status) where.status = query.status;
    if (query.onlyActive === 'true') where.status = 'ACTIVE';

    return this.prisma.machineInstalledPart.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getInstalledPartById(id: string) {
    const part = await this.prisma.machineInstalledPart.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!part) throw new NotFoundException('Installed part not found');
    return part;
  }

  async getInstalledPartsByMachine(machineId: string) {
    return this.prisma.machineInstalledPart.findMany({
      where: { machineId },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getInstalledPartsByRequest(maintenanceRequestId: string) {
    return this.prisma.machineInstalledPart.findMany({
      where: { maintenanceRequestId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getReplacementHistory(query: QueryReplacementHistoryDto) {
    const where: any = {};
    if (query.machineId) where.machineId = query.machineId;
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.requiredPartId) where.requiredPartId = query.requiredPartId;

    return this.prisma.sparePartReplacementHistory.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
      take: query.limit || 50,
    });
  }

  async getReplacementHistoryByMachine(machineId: string) {
    return this.prisma.sparePartReplacementHistory.findMany({
      where: { machineId },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
    });
  }

  async getReplacementHistoryByRequest(maintenanceRequestId: string) {
    return this.prisma.sparePartReplacementHistory.findMany({
      where: { maintenanceRequestId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
    });
  }

  async getActiveInstalledPartsCount(machineId: string): Promise<number> {
    return this.prisma.machineInstalledPart.count({
      where: { machineId, status: 'ACTIVE' },
    });
  }

  async getReplacementCount(machineId: string): Promise<number> {
    return this.prisma.sparePartReplacementHistory.count({
      where: { machineId },
    });
  }
}
