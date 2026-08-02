import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto, UpdateMachineLocationDto, UpdateMachineManufacturerDto, UpdateMachineWarrantyDto, UpdateMachineImageDto } from './dto/maintenance.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private auditService: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async ensureMachineAccess(id: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async validateMachineReferences(dto: any, existing?: any, ctx?: ActiveOperationalContext) {
    const companyId = dto.companyId ?? existing?.companyId;
    const branchId = dto.branchId ?? existing?.branchId;
    const administrationId = dto.administrationId ?? existing?.administrationId;
    const departmentId = dto.departmentId ?? existing?.departmentId;

    if (ctx && companyId !== ctx.companyId) {
      throw this.validationError('companyId', 'validation.invalidValue', 'Machine company must match the active operational context');
    }
    if (ctx && branchId && branchId !== ctx.branchId) {
      throw this.validationError('branchId', 'validation.invalidValue', 'Machine branch must match the active operational context');
    }

    if (dto.productionLineId) {
      const line = await this.prisma.productionLine.findUnique({ where: { id: dto.productionLineId } });
      if (!line) throw this.validationError('productionLineId', 'validation.invalidReference', 'Production line not found');
      if (companyId && line.companyId !== companyId) throw this.validationError('productionLineId', 'validation.invalidValue', 'Production line does not belong to the selected company');
      if (branchId && line.branchId !== branchId) throw this.validationError('productionLineId', 'validation.invalidValue', 'Production line does not belong to the selected branch');
      if (administrationId && line.administrationId && line.administrationId !== administrationId) throw this.validationError('productionLineId', 'validation.invalidValue', 'Production line does not belong to the selected administration');
      if (departmentId && line.departmentId !== departmentId) throw this.validationError('productionLineId', 'validation.invalidValue', 'Production line does not belong to the selected department');
    }

    if (dto.operationTypeId) {
      const ot = await this.prisma.operationType.findUnique({ where: { id: dto.operationTypeId } });
      if (!ot) throw this.validationError('operationTypeId', 'validation.invalidReference', 'Operation type not found');
    }

    if (dto.defaultCostCenterId) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: dto.defaultCostCenterId } });
      if (!cc) throw this.validationError('defaultCostCenterId', 'validation.invalidReference', 'Cost center not found');
    }

    if (dto.technicalAdministrationId) {
      const ta = await this.prisma.administration.findUnique({ where: { id: dto.technicalAdministrationId } });
      if (!ta) throw this.validationError('technicalAdministrationId', 'validation.invalidReference', 'Technical administration not found');
    }

    if (dto.technicalDepartmentId) {
      const td = await this.prisma.department.findUnique({ where: { id: dto.technicalDepartmentId } });
      if (!td) throw this.validationError('technicalDepartmentId', 'validation.invalidReference', 'Technical department not found');
      if (dto.technicalAdministrationId && td.administrationId !== dto.technicalAdministrationId) {
        throw this.validationError('technicalDepartmentId', 'validation.invalidValue', 'Technical department does not belong to the selected technical administration');
      }
    }
  }

  async createMachine(dto: CreateMachineDto, userId: string, ctx: ActiveOperationalContext) {
    const dataDto: any = { ...dto };
    dataDto.companyId = ctx.companyId;
    dataDto.branchId = ctx.branchId;
    const code = dataDto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE');
    const existing = await this.prisma.machine.findUnique({ where: { code } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Machine code already exists');
    await this.validateMachineReferences(dataDto, undefined, ctx);
    const { purchaseDate, warrantyEnd, ...rest } = dataDto;
    const machine = await this.prisma.machine.create({
      data: {
        ...rest,
        code,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : undefined,
      },
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        productionLine: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        defaultCostCenter: { select: { id: true, name: true, code: true } },
        technicalAdministration: { select: { id: true, name: true } },
        technicalDepartment: { select: { id: true, name: true } },
      },
    });
    await this.auditService.log(userId, 'CREATE', 'Machine', machine.id, { message: `Created machine: ${machine.code}` });
    return machine;
  }

  async findAllMachines(query: { page?: number; limit?: number; search?: string; categoryId?: string; companyId?: string; branchId?: string; administrationId?: string; departmentId?: string; productionLineId?: string; operationTypeId?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, ...this.machineScope(ctx) };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { serialNumber: { contains: query.search } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.operationTypeId) where.operationTypeId = query.operationTypeId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          productionLine: { select: { id: true, name: true, code: true } },
          operationType: { select: { id: true, name: true, code: true } },
          defaultCostCenter: { select: { id: true, name: true, code: true } },
          technicalAdministration: { select: { id: true, name: true } },
          technicalDepartment: { select: { id: true, name: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneMachine(id: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        productionLine: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        defaultCostCenter: { select: { id: true, name: true, code: true } },
        technicalAdministration: { select: { id: true, name: true } },
        technicalDepartment: { select: { id: true, name: true } },
        parts: true,
        documents: true,
        _count: { select: { maintenanceReqs: true, schedules: true, downtimeLogs: true } },
      },
    });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  async updateMachine(id: string, dto: UpdateMachineDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOneMachine(id, ctx);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    await this.validateMachineReferences(dto, existing, ctx);
    const { code, purchaseDate, warrantyEnd, ...rest } = dto as any;
    const data: any = { ...rest };
    if (purchaseDate) data.purchaseDate = new Date(purchaseDate);
    if (warrantyEnd) data.warrantyEnd = new Date(warrantyEnd);
    const machine = await this.prisma.machine.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        productionLine: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        defaultCostCenter: { select: { id: true, name: true, code: true } },
        technicalAdministration: { select: { id: true, name: true } },
        technicalDepartment: { select: { id: true, name: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Updated machine: ${machine.code}` });
    return machine;
  }

  async removeMachine(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOneMachine(id, ctx);
    const componentCount = await this.prisma.machineComponent.count({ where: { machineId: id, deletedAt: null } });
    if (componentCount > 0) throw new ConflictException('Cannot delete machine with linked components');
    const reqCount = await this.prisma.maintenanceRequest.count({ where: { machineId: id, deletedAt: null } });
    if (reqCount > 0) throw new ConflictException('Cannot delete machine with linked maintenance requests');
    const scheduleCount = await this.prisma.maintenanceSchedule.count({ where: { machineId: id } });
    if (scheduleCount > 0) throw new ConflictException('Cannot delete machine with linked schedules');
    const dtCount = await this.prisma.downtimeLog.count({ where: { machineId: id } });
    if (dtCount > 0) throw new ConflictException('Cannot delete machine with linked downtime logs');
    await this.prisma.machine.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'Machine', id, { message: `Deleted machine: ${existing.code}` });
    return { message: 'Machine deleted successfully' };
  }

  async createPart(dto: CreateMachinePartDto, ctx: ActiveOperationalContext) {
    if (dto.machineId) await this.ensureMachineAccess(dto.machineId, ctx);
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE_PART');
    return this.prisma.machinePart.create({ data: { ...dto, code } });
  }

  async findParts(machineId: string | undefined, ctx: ActiveOperationalContext) {
    const where: any = {};
    if (machineId) {
      await this.ensureMachineAccess(machineId, ctx);
      where.machineId = machineId;
    } else {
      const machines = await this.prisma.machine.findMany({ where: this.machineScope(ctx), select: { id: true } });
      where.machineId = { in: machines.map((m) => m.id) };
    }
    return this.prisma.machinePart.findMany({
      where,
      include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updatePart(id: string, dto: Partial<CreateMachinePartDto>, ctx: ActiveOperationalContext) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    if (part.machineId) await this.ensureMachineAccess(part.machineId, ctx);
    if (dto.machineId && dto.machineId !== part.machineId) await this.ensureMachineAccess(dto.machineId, ctx);
    return this.prisma.machinePart.update({ where: { id }, data: dto });
  }

  async removePart(id: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    if (part.machineId) await this.ensureMachineAccess(part.machineId, ctx);
    return this.prisma.machinePart.delete({ where: { id } });
  }

  async createDocument(dto: CreateMachineDocumentDto, ctx: ActiveOperationalContext) {
    await this.ensureMachineAccess(dto.machineId, ctx);
    return this.prisma.machineDocument.create({ data: dto });
  }

  async findDocuments(machineId: string, ctx: ActiveOperationalContext) {
    await this.ensureMachineAccess(machineId, ctx);
    return this.prisma.machineDocument.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateMachine(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'Machine', id, { message: `Activated machine: ${machine.code}` });
    return machine;
  }

  async deactivateMachine(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'Machine', id, { message: `Deactivated machine: ${machine.code}` });
    return machine;
  }

  async updateMachineStatus(id: string, status: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: { status } });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Changed machine status: ${machine.code}` });
    return machine;
  }

  async updateMachineLocation(id: string, dto: UpdateMachineLocationDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: { location: dto.location } });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Updated machine location: ${machine.code}` });
    return machine;
  }

  async updateMachineManufacturer(id: string, dto: UpdateMachineManufacturerDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Updated machine manufacturer: ${machine.code}` });
    return machine;
  }

  async updateMachineWarranty(id: string, dto: UpdateMachineWarrantyDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const data: any = {};
    if (dto.purchaseDate) data.purchaseDate = new Date(dto.purchaseDate);
    if (dto.warrantyEnd) data.warrantyEnd = new Date(dto.warrantyEnd);
    const machine = await this.prisma.machine.update({ where: { id }, data });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Updated machine warranty: ${machine.code}` });
    return machine;
  }

  async updateMachineImage(id: string, dto: UpdateMachineImageDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const machine = await this.prisma.machine.update({ where: { id }, data: { image: dto.image } });
    await this.auditService.log(userId, 'UPDATE', 'Machine', id, { message: `Updated machine image: ${machine.code}` });
    return machine;
  }

  async getMachineCard(id: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        productionLine: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        defaultCostCenter: { select: { id: true, name: true, code: true } },
        technicalAdministration: { select: { id: true, name: true } },
        technicalDepartment: { select: { id: true, name: true } },
        _count: { select: { parts: true, documents: true, maintenanceReqs: true, schedules: true, downtimeLogs: true } },
      },
    });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  async getMachineOperationalStatus(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    const now = new Date();
    const [activeRequest, activeDowntime, openTasks, activeSchedule] = await Promise.all([
      this.prisma.maintenanceRequest.findFirst({ where: { machineId: id, status: 'IN_PROGRESS', deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.downtimeLog.findFirst({ where: { machineId: id, endTime: null, cancelledAt: null }, orderBy: { startTime: 'desc' } }),
      this.prisma.maintenanceTask.count({ where: { request: { machineId: id }, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.prisma.maintenanceSchedule.findFirst({ where: { machineId: id, status: 'ACTIVE' } }),
    ]);
    return { activeRequest, activeDowntime, openTasks, activeSchedule, checkedAt: now };
  }

  async getMachineComponents(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    return this.prisma.machineComponent.findMany({
      where: { machineId: id, deletedAt: null },
      include: {
        parentComponent: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getMachineParts(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    return this.prisma.machinePart.findMany({
      where: { machineId: id },
      include: { product: { select: { id: true, name: true, code: true, unit: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getMachineDocuments(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    return this.prisma.machineDocument.findMany({
      where: { machineId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMachineAttachments(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    return this.prisma.attachment.findMany({
      where: { entityName: 'MACHINE', entityId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMachineActivity(id: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(id, ctx);
    return this.prisma.auditLog.findMany({
      where: { entity: 'MACHINE', entityId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async scopedMachineIds(ctx: ActiveOperationalContext): Promise<string[]> {
    const machines = await this.prisma.machine.findMany({ where: this.machineScope(ctx), select: { id: true } });
    return machines.map((m) => m.id);
  }

  async getRequestSummary(ctx: ActiveOperationalContext) {
    const machineIds = await this.scopedMachineIds(ctx);
    const machineFilter = machineIds.length > 0 ? { machineId: { in: machineIds } } : { machineId: 'NO_ACCESS' };
    const [total, open, inProgress, completed, cancelled, overdueCount] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { ...machineFilter, deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { ...machineFilter, status: 'OPEN', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { ...machineFilter, status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { ...machineFilter, status: 'COMPLETED', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { ...machineFilter, status: 'CANCELLED', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({
        where: { ...machineFilter, status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: null, deletedAt: null },
      }),
    ]);
    return { total, open, inProgress, completed, cancelled, overdue: overdueCount };
  }

  async getDowntimeSummary(ctx: ActiveOperationalContext) {
    const machineIds = await this.scopedMachineIds(ctx);
    const machineFilter = machineIds.length > 0 ? { machineId: { in: machineIds } } : { machineId: 'NO_ACCESS' };
    const [total, active, closed, cancelled, agg] = await Promise.all([
      this.prisma.downtimeLog.count({ where: machineFilter }),
      this.prisma.downtimeLog.count({ where: { ...machineFilter, endTime: null, cancelledAt: null } }),
      this.prisma.downtimeLog.count({ where: { ...machineFilter, endTime: { not: null } } }),
      this.prisma.downtimeLog.count({ where: { ...machineFilter, cancelledAt: { not: null } } }),
      this.prisma.downtimeLog.aggregate({
        where: { ...machineFilter, cancelledAt: null },
        _sum: { durationMinutes: true },
      }),
    ]);
    const totalDurationHours = agg._sum.durationMinutes
      ? Math.round((agg._sum.durationMinutes / 60) * 100) / 100
      : 0;
    return { total, active, closed, cancelled, totalDurationHours };
  }

  async getScheduleSummary(ctx: ActiveOperationalContext) {
    const machineIds = await this.scopedMachineIds(ctx);
    const machineFilter = machineIds.length > 0 ? { machineId: { in: machineIds } } : { machineId: 'NO_ACCESS' };
    const now = new Date();
    const [total, active, inactive, overdue, dueSoon, notDue, expired] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where: machineFilter }),
      this.prisma.maintenanceSchedule.count({ where: { ...machineFilter, status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...machineFilter, status: 'INACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...machineFilter, status: 'ACTIVE', startDate: { lte: now } } }),
      this.prisma.maintenanceSchedule.count({
        where: { ...machineFilter, status: 'ACTIVE', startDate: { gt: now, lte: new Date(now.getTime() + 7 * 86400000) } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { ...machineFilter, status: 'ACTIVE', startDate: { gt: new Date(now.getTime() + 7 * 86400000) } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { ...machineFilter, status: 'ACTIVE', endDate: { not: null, lte: now } },
      }),
    ]);
    return { total, active, inactive, overdue, dueSoon, notDue, expired };
  }

  async removeDocument(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.prisma.machineDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.ensureMachineAccess(doc.machineId, ctx);
    return this.prisma.machineDocument.delete({ where: { id } });
  }

  async getMachineSummary(id: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
    });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeRequests, openTasks, activeDowntime, downtimeAgg, nextSchedule] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { machineId: id, status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.maintenanceTask.count({ where: { request: { machineId: id }, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.prisma.downtimeLog.count({ where: { machineId: id, endTime: null, cancelledAt: null } }),
      this.prisma.downtimeLog.aggregate({ where: { machineId: id, cancelledAt: null, startTime: { gte: monthStart } }, _sum: { durationMinutes: true } }),
      this.prisma.maintenanceSchedule.findFirst({ where: { machineId: id, status: 'ACTIVE', startDate: { gte: now } }, orderBy: { startDate: 'asc' } }),
    ]);

    const totalDowntimeHours = downtimeAgg._sum.durationMinutes
      ? Math.round((downtimeAgg._sum.durationMinutes / 60) * 100) / 100
      : 0;

    return {
      id: machine.id, code: machine.code, name: machine.name, status: machine.status, category: machine.category,
      activeRequests, openTasks, activeDowntime, totalDowntimeHoursThisMonth: totalDowntimeHours,
      nextMaintenanceDueDate: nextSchedule?.startDate || null,
      nextMaintenanceTitle: nextSchedule?.title || null,
      dueStatus: nextSchedule ? (nextSchedule.startDate > now ? 'notDue' : 'overdue') : null,
    };
  }

  async getMachineMaintenanceLog(machineId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(machineId, ctx);
    const [requests, tasks, downtimeLogs] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: { machineId, status: 'COMPLETED', deletedAt: null },
        include: {
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { endDate: 'desc' },
        take: 50,
      }),
      this.prisma.maintenanceTask.findMany({
        where: { request: { machineId }, status: 'DONE' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 50,
      }),
      this.prisma.downtimeLog.findMany({
        where: { machineId, cancelledAt: null, endTime: { not: null } },
        include: {
          request: { select: { id: true, requestNumber: true, title: true } },
        },
        orderBy: { startTime: 'desc' },
        take: 50,
      }),
    ]);
    return { requests, tasks, downtimeLogs };
  }

  async getMachineDowntime(machineId: string, ctx: ActiveOperationalContext) {
    await this.findOneMachine(machineId, ctx);
    const logs = await this.prisma.downtimeLog.findMany({
      where: { machineId },
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { startTime: 'desc' },
    });
    return logs.map((log: any) => ({
      ...log,
      status: log.cancelledAt ? 'CANCELLED' : log.endTime ? 'CLOSED' : 'ACTIVE',
      durationHours: log.durationMinutes ? log.durationMinutes / 60 : null,
    }));
  }

  async getOperationalSummary(ctx: ActiveOperationalContext) {
    const machines = await this.prisma.machine.findMany({
      where: { deletedAt: null, ...this.machineScope(ctx) },
      include: { category: { select: { id: true, name: true, code: true } } },
    });

    const machineIds = machines.map((m) => m.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeRequests, openTasksWithMachine, activeDowntimes, currentMonthDowntime, nextSchedules] = machineIds.length > 0
      ? await Promise.all([
          this.prisma.maintenanceRequest.groupBy({
            by: ['machineId'], where: { machineId: { in: machineIds }, status: 'IN_PROGRESS', deletedAt: null }, _count: true,
          }),
          this.prisma.maintenanceTask.findMany({
            where: { request: { machineId: { in: machineIds } }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            select: { id: true, request: { select: { machineId: true } } },
          }),
          this.prisma.downtimeLog.groupBy({
            by: ['machineId'], where: { machineId: { in: machineIds }, endTime: null, cancelledAt: null }, _count: true,
          }),
          this.prisma.downtimeLog.groupBy({
            by: ['machineId'], where: { machineId: { in: machineIds }, cancelledAt: null, startTime: { gte: monthStart } }, _sum: { durationMinutes: true },
          }),
          this.prisma.maintenanceSchedule.findMany({
            where: { machineId: { in: machineIds }, status: 'ACTIVE', startDate: { gte: now } },
            orderBy: { startDate: 'asc' },
            distinct: ['machineId'],
            select: { machineId: true, startDate: true, title: true },
          }),
        ])
      : [[], [], [], [], []];

    const activeReqMap = Object.fromEntries(activeRequests.map((r) => [r.machineId, r._count]));
    const openTaskCountByMachine: Record<string, number> = {};
    for (const t of openTasksWithMachine) {
      const mid = t.request.machineId;
      openTaskCountByMachine[mid] = (openTaskCountByMachine[mid] || 0) + 1;
    }
    const activeDowntimeMap = Object.fromEntries(activeDowntimes.map((r) => [r.machineId, r._count]));
    const downtimeMinutesMap = Object.fromEntries(currentMonthDowntime.map((r) => [r.machineId, r._sum.durationMinutes || 0]));
    const scheduleMap = Object.fromEntries(nextSchedules.map((s) => [s.machineId, s]));

    const summaries = machines.map((m) => {
      const nextSch = scheduleMap[m.id];
      return {
        id: m.id, code: m.code, name: m.name, status: m.status, category: m.category,
        activeRequests: activeReqMap[m.id] || 0,
        openTasks: openTaskCountByMachine[m.id] || 0,
        activeDowntime: activeDowntimeMap[m.id] || 0,
        totalDowntimeHoursThisMonth: downtimeMinutesMap[m.id] ? Math.round((downtimeMinutesMap[m.id] / 60) * 100) / 100 : 0,
        nextMaintenanceDueDate: nextSch?.startDate || null,
        nextMaintenanceTitle: nextSch?.title || null,
        dueStatus: nextSch ? (nextSch.startDate > now ? 'notDue' : 'overdue') : null,
      };
    });

    return {
      machines: summaries,
      totals: {
        totalMachines: machines.length,
        totalActiveRequests: summaries.reduce((s, m) => s + m.activeRequests, 0),
        totalOpenTasks: summaries.reduce((s, m) => s + m.openTasks, 0),
        totalActiveDowntime: summaries.reduce((s, m) => s + m.activeDowntime, 0),
        totalDowntimeHoursThisMonth: Math.round(summaries.reduce((s, m) => s + m.totalDowntimeHoursThisMonth, 0) * 100) / 100,
      },
    };
  }
}
