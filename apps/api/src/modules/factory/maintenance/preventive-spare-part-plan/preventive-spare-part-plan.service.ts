import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import {
  QueryPreventiveSparePartPlanDto, CreatePreventiveSparePartPlanDto, UpdatePreventiveSparePartPlanDto,
  CreatePlanItemDto, UpdatePlanItemDto, GeneratePlanFromScheduleDto, CopyToRequestDto,
} from './dto/preventive-spare-part-plan.dto';

@Injectable()
export class PreventiveSparePartPlanService {
  private readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePreventiveSparePartPlanDto, userId: string) {
    await this.validateScheduleAndMachine(dto.scheduleId, dto.machineId);
    const planNumber = await this.numberingService.generateNumberAtomic('PREVENTIVE_SPARE_PART_PLAN');
    const plan = await this.prisma.preventiveSparePartPlan.create({
      data: { ...dto, planNumber, generatedById: userId },
    });
    await this.audit.log(userId, 'CREATE', 'PreventiveSparePartPlan', plan.id, { dto });
    return this.findById(plan.id);
  }

  async findAll(query: QueryPreventiveSparePartPlanDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.scheduleId) where.scheduleId = query.scheduleId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { planNumber: { contains: query.search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.preventiveSparePartPlan.findMany({
        where, skip, take: limit,
        include: { schedule: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.preventiveSparePartPlan.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const plan = await this.prisma.preventiveSparePartPlan.findUnique({
      where: { id },
      include: {
        schedule: true,
        machine: { select: { id: true, code: true, name: true } },
        generatedBy: { select: { id: true, name: true } },
        items: {
          include: { sparePart: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('maintenance.planNotFound');
    return plan;
  }

  async update(id: string, dto: UpdatePreventiveSparePartPlanDto, userId: string) {
    const plan = await this.findById(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('maintenance.cannotUpdateNonDraftPlan');
    }
    if (dto.scheduleId) {
      const machineId = dto.machineId || plan.machineId;
      await this.validateScheduleAndMachine(dto.scheduleId, machineId);
    }
    const updated = await this.prisma.preventiveSparePartPlan.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'PreventiveSparePartPlan', id, { dto });
    return this.findById(updated.id);
  }

  async remove(id: string, userId: string) {
    const plan = await this.findById(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('maintenance.cannotDeleteNonDraftPlan');
    }
    await this.prisma.preventiveSparePartPlan.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'PreventiveSparePartPlan', id, {});
    return { success: true };
  }

  async transition(id: string, newStatus: string, userId: string) {
    const plan = await this.findById(id);
    const allowed = this.ALLOWED_TRANSITIONS[plan.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException('maintenance.invalidPlanStatusTransition');
    }
    const updated = await this.prisma.preventiveSparePartPlan.update({
      where: { id }, data: { status: newStatus },
    });
    await this.audit.log(userId, `STATUS_${newStatus}`, 'PreventiveSparePartPlan', id, { from: plan.status, to: newStatus });
    return this.findById(updated.id);
  }

  // ── Generate from schedule ──
  async generateFromSchedule(scheduleId: string, dto: GeneratePlanFromScheduleDto, userId: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        machine: {
          include: {
            boms: {
              where: { status: 'ACTIVE', deletedAt: null },
              include: {
                versions: {
                  where: { isActive: true },
                  include: {
                    items: { include: { sparePart: true } },
                  },
                },
              },
            },
            components: {
              include: {
                boms: {
                  where: { status: 'ACTIVE', deletedAt: null },
                  include: {
                    versions: {
                      where: { isActive: true },
                      include: {
                        items: { include: { sparePart: true } },
                      },
                    },
                  },
                },
                spareParts: {
                  where: { status: 'ACTIVE' },
                  include: { sparePart: true },
                },
              },
            },
            spareParts: {
              where: { status: 'ACTIVE' },
              include: { sparePart: true },
            },
          },
        },
      },
    });
    if (!schedule) throw new NotFoundException('maintenance.scheduleNotFound');

    const planNumber = await this.numberingService.generateNumberAtomic('PREVENTIVE_SPARE_PART_PLAN');
    const plan = await this.prisma.preventiveSparePartPlan.create({
      data: {
        scheduleId,
        machineId: schedule.machineId,
        title: dto.title || `Spare Part Plan - ${schedule.title}`,
        description: dto.description,
        status: 'DRAFT',
        generatedById: userId,
        planNumber,
      },
    });

    // Collect spare parts from active BOM items and direct spare part links
    const sparePartMap = new Map<string, { quantity: number; sparePart: any }>();
    const machine = schedule.machine;

    // From machine-level BOM items
    for (const bom of machine.boms || []) {
      for (const version of bom.versions || []) {
        for (const item of version.items || []) {
          const existing = sparePartMap.get(item.sparePartId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            sparePartMap.set(item.sparePartId, { quantity: item.quantity, sparePart: item.sparePart });
          }
        }
      }
    }

    // From component-level BOM items and ComponentSparePart links
    for (const component of machine.components || []) {
      for (const bom of component.boms || []) {
        for (const version of bom.versions || []) {
          for (const item of version.items || []) {
            const existing = sparePartMap.get(item.sparePartId);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              sparePartMap.set(item.sparePartId, { quantity: item.quantity, sparePart: item.sparePart });
            }
          }
        }
      }
      // From ComponentSparePart direct links (fallback if no BOM)
      for (const cp of component.spareParts || []) {
        if (!Array.from(sparePartMap.keys()).includes(cp.sparePartId)) {
          sparePartMap.set(cp.sparePartId, { quantity: cp.quantity, sparePart: cp.sparePart });
        }
      }
    }

    // From MachineSparePart direct links (fallback if no BOM)
    for (const mp of machine.spareParts || []) {
      if (!Array.from(sparePartMap.keys()).includes(mp.sparePartId)) {
        sparePartMap.set(mp.sparePartId, { quantity: mp.quantity, sparePart: mp.sparePart });
      }
    }

    // Create plan items (no stock mutation — read-only availability)
    if (sparePartMap.size > 0) {
      const items = await Promise.all(
        Array.from(sparePartMap.entries()).map(async ([sparePartId, data]) => {
          const availableQuantity = await this.getAvailableStock(sparePartId);
          return this.prisma.preventiveSparePartPlanItem.create({
            data: {
              planId: plan.id,
              sparePartId,
              plannedQuantity: data.quantity,
              availableQuantity,
              unit: data.sparePart?.unit,
              isAvailable: availableQuantity !== null && availableQuantity >= data.quantity,
            },
          });
        }),
      );
      await this.audit.log(userId, 'GENERATE_FROM_SCHEDULE', 'PreventiveSparePartPlan', plan.id, {
        scheduleId, itemCount: items.length,
      });
    }

    return this.findById(plan.id);
  }

  private async getAvailableStock(sparePartId: string): Promise<number | null> {
    const sparePart = await this.prisma.sparePart.findUnique({
      where: { id: sparePartId },
      select: { productId: true },
    });
    if (!sparePart?.productId) return null;
    const result = await this.prisma.inventoryBalance.aggregate({
      where: { productId: sparePart.productId },
      _sum: { quantity: true },
    });
    return result._sum.quantity || 0;
  }

  // ── Items ──
  async getItems(planId: string) {
    await this.findById(planId);
    return this.prisma.preventiveSparePartPlanItem.findMany({
      where: { planId },
      include: { sparePart: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addItem(planId: string, dto: CreatePlanItemDto, userId: string) {
    const plan = await this.findById(planId);
    if (plan.status !== 'DRAFT' && plan.status !== 'ACTIVE') {
      throw new BadRequestException('maintenance.cannotModifyPlanItemsInCurrentStatus');
    }
    const item = await this.prisma.preventiveSparePartPlanItem.create({
      data: { planId, ...dto },
    });
    await this.audit.log(userId, 'ADD_ITEM', 'PreventiveSparePartPlanItem', item.id, { planId });
    return this.prisma.preventiveSparePartPlanItem.findUnique({
      where: { id: item.id },
      include: { sparePart: true },
    });
  }

  async updateItem(itemId: string, dto: UpdatePlanItemDto, userId: string) {
    const existing = await this.prisma.preventiveSparePartPlanItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('maintenance.planItemNotFound');
    const updated = await this.prisma.preventiveSparePartPlanItem.update({ where: { id: itemId }, data: dto });
    await this.audit.log(userId, 'UPDATE_ITEM', 'PreventiveSparePartPlanItem', itemId, { dto });
    return this.prisma.preventiveSparePartPlanItem.findUnique({
      where: { id: updated.id },
      include: { sparePart: true },
    });
  }

  async removeItem(itemId: string, userId: string) {
    const existing = await this.prisma.preventiveSparePartPlanItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('maintenance.planItemNotFound');
    await this.prisma.preventiveSparePartPlanItem.delete({ where: { id: itemId } });
    await this.audit.log(userId, 'REMOVE_ITEM', 'PreventiveSparePartPlanItem', itemId, {});
    return { success: true };
  }

  async refreshAvailability(planId: string, userId: string) {
    const plan = await this.findById(planId);
    const items = plan.items;
    for (const item of items) {
      const availableQuantity = await this.getAvailableStock(item.sparePartId);
      await this.prisma.preventiveSparePartPlanItem.update({
        where: { id: item.id },
        data: {
          availableQuantity,
          isAvailable: availableQuantity !== null && availableQuantity >= item.plannedQuantity,
        },
      });
    }
    await this.audit.log(userId, 'REFRESH_AVAILABILITY', 'PreventiveSparePartPlan', planId, { itemCount: items.length });
    return this.findById(planId);
  }

  // ── Copy to request ──
  async copyToRequest(planId: string, dto: CopyToRequestDto, userId: string) {
    const plan = await this.findById(planId);
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('maintenance.requestNotFound');

    const items = dto.itemIds?.length
      ? plan.items.filter(i => dto.itemIds!.includes(i.id))
      : plan.items;

    if (items.length === 0) throw new BadRequestException('maintenance.noItemsToCopy');

    const createdParts = [];
    for (const item of items) {
      const requiredPart = await this.prisma.maintenanceRequestRequiredPart.create({
        data: {
          maintenanceRequestId: dto.requestId,
          sparePartId: item.sparePartId,
          machineId: plan.machineId,
          quantity: item.plannedQuantity,
          unit: item.unit,
          status: 'REQUESTED',
        },
      });
      // Link the plan item back to the created request part
      await this.prisma.preventiveSparePartPlanItem.update({
        where: { id: item.id },
        data: { copyToRequestId: dto.requestId },
      });
      createdParts.push(requiredPart);
    }

    // Mark plan as ACTIVE if still DRAFT
    if (plan.status === 'DRAFT') {
      await this.prisma.preventiveSparePartPlan.update({
        where: { id: planId },
        data: { status: 'ACTIVE' },
      });
    }

    await this.audit.log(userId, 'COPY_TO_REQUEST', 'PreventiveSparePartPlan', planId, {
      requestId: dto.requestId,
      itemCount: createdParts.length,
    });

    return { success: true, createdParts: createdParts.length };
  }

  // ── Helpers ──
  private async validateScheduleAndMachine(scheduleId: string, machineId: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, machineId: true },
    });
    if (!schedule) throw new NotFoundException('maintenance.scheduleNotFound');
    if (schedule.machineId !== machineId) {
      throw new BadRequestException('maintenance.scheduleMachineMismatch');
    }
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('maintenance.machineNotFound');
  }
}
