import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private branchScope(ctx: ActiveOperationalContext) {
    return {
      OR: [{ branchId: null }, { branchId: ctx.branchId }],
    };
  }

  private tenantWhere(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      AND: [this.branchScope(ctx)],
    };
  }

  private machineWhere(ctx: ActiveOperationalContext) {
    return {
      ...this.tenantWhere(ctx),
      deletedAt: null,
    };
  }

  private warehouseWhere(ctx: ActiveOperationalContext) {
    return {
      ...this.tenantWhere(ctx),
      deletedAt: null,
    };
  }

  async getSummary(ctx: ActiveOperationalContext, userId: string) {
    const tenantWhere = this.tenantWhere(ctx);
    const [
      users,
      roles,
      permissions,
      products,
      warehouses,
      machines,
      companies,
      branches,
      departments,
      productCategories,
      machineCategories,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { ...tenantWhere, deletedAt: null },
      }),
      this.prisma.role.count(),
      this.prisma.permission.count(),
      this.prisma.product.count(),
      this.prisma.warehouse.count({
        where: this.warehouseWhere(ctx),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(ctx),
      }),
      this.prisma.company.count({
        where: { id: ctx.companyId, deletedAt: null },
      }),
      this.prisma.branch.count({
        where: {
          id: ctx.branchId,
          companyId: ctx.companyId,
          deletedAt: null,
        },
      }),
      this.prisma.department.count({
        where: { ...tenantWhere, deletedAt: null },
      }),
      this.prisma.productCategory.count(),
      this.prisma.machineCategory.count(),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);
    return {
      users,
      roles,
      permissions,
      products,
      warehouses,
      machines,
      companies,
      branches,
      departments,
      productCategories,
      machineCategories,
      unreadNotifications,
    };
  }

  async getOperations(ctx: ActiveOperationalContext) {
    const tenantWhere = this.tenantWhere(ctx);
    const machineWhere = this.machineWhere(ctx);
    const [
      machinesByStatus,
      openRequests,
      countsByStatus,
      overdueSchedules,
      currentDowntime,
      movements,
      adjustments,
    ] = await Promise.all([
      this.prisma.machine.groupBy({
        by: ['status'],
        where: machineWhere,
        _count: true,
      }),
      this.prisma.maintenanceRequest.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          deletedAt: null,
          machine: machineWhere,
        },
      }),
      this.prisma.inventoryCount.groupBy({
        by: ['status'],
        where: { ...tenantWhere, deletedAt: null },
        _count: true,
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          status: 'ACTIVE',
          machine: machineWhere,
        },
      }),
      this.prisma.downtimeLog.count({
        where: {
          endTime: null,
          cancelledAt: null,
          machine: machineWhere,
        },
      }),
      this.prisma.inventoryMovement.count({
        where: {
          ...tenantWhere,
          deletedAt: null,
          warehouse: this.warehouseWhere(ctx),
        },
      }),
      this.prisma.inventoryAdjustment.count({
        where: {
          ...tenantWhere,
          deletedAt: null,
          warehouse: this.warehouseWhere(ctx),
        },
      }),
    ]);
    return {
      machinesByStatus,
      openRequests,
      countsByStatus,
      overdueSchedules,
      currentDowntime,
      movements,
      adjustments,
    };
  }

  async getAlerts(ctx: ActiveOperationalContext) {
    const machineWhere = this.machineWhere(ctx);
    const [
      criticalRequests,
      overdueSchedules,
      currentDowntime,
      machinesUnderMaintenance,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: {
          priority: 'CRITICAL',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          deletedAt: null,
          machine: machineWhere,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          status: 'ACTIVE',
          machine: machineWhere,
        },
      }),
      this.prisma.downtimeLog.count({
        where: {
          endTime: null,
          cancelledAt: null,
          machine: machineWhere,
        },
      }),
      this.prisma.machine.count({
        where: {
          ...machineWhere,
          status: 'UNDER_MAINTENANCE',
        },
      }),
      this.prisma.inventoryBalance.count({
        where: {
          quantity: { lte: 0 },
          warehouse: this.warehouseWhere(ctx),
        },
      }),
    ]);
    return {
      criticalRequests,
      overdueSchedules,
      currentDowntime,
      machinesUnderMaintenance,
      lowStockProducts,
    };
  }

  async getKpis(ctx: ActiveOperationalContext) {
    const tenantWhere = this.tenantWhere(ctx);
    const machineWhere = this.machineWhere(ctx);
    const [
      totalMachines,
      totalRequests,
      completedRequests,
      totalCounts,
      totalMovements,
    ] = await Promise.all([
      this.prisma.machine.count({ where: machineWhere }),
      this.prisma.maintenanceRequest.count({
        where: {
          deletedAt: null,
          machine: machineWhere,
        },
      }),
      this.prisma.maintenanceRequest.count({
        where: {
          status: 'COMPLETED',
          deletedAt: null,
          machine: machineWhere,
        },
      }),
      this.prisma.inventoryCount.count({
        where: { ...tenantWhere, deletedAt: null },
      }),
      this.prisma.inventoryMovement.count({
        where: {
          ...tenantWhere,
          deletedAt: null,
          warehouse: this.warehouseWhere(ctx),
        },
      }),
    ]);
    return {
      totalMachines,
      totalRequests,
      completedRequests,
      totalCounts,
      totalMovements,
    };
  }
}
