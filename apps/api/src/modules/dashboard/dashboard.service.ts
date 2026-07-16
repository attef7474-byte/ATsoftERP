import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [users, roles, permissions, products, warehouses, machines, companies, branches, departments, productCategories, machineCategories, unreadNotifications] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.permission.count(),
      this.prisma.product.count(),
      this.prisma.warehouse.count(),
      this.prisma.machine.count(),
      this.prisma.company.count(),
      this.prisma.branch.count(),
      this.prisma.department.count(),
      this.prisma.productCategory.count(),
      this.prisma.machineCategory.count(),
      this.prisma.notification.count({ where: { read: false } }),
    ])
    return { users, roles, permissions, products, warehouses, machines, companies, branches, departments, productCategories, machineCategories, unreadNotifications }
  }

  async getOperations() {
    const [machinesByStatus, openRequests, countsByStatus, overdueSchedules, currentDowntime, movements, adjustments] = await Promise.all([
      this.prisma.machine.groupBy({ by: ['status'], _count: true }),
      this.prisma.maintenanceRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.inventoryCount.groupBy({ by: ['status'], _count: true }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.downtimeLog.count({ where: { endTime: null } }),
      this.prisma.inventoryMovement.count(),
      this.prisma.inventoryAdjustment.count(),
    ])
    return { machinesByStatus, openRequests, countsByStatus, overdueSchedules, currentDowntime, movements, adjustments }
  }

  async getAlerts() {
    const [criticalRequests, overdueSchedules, currentDowntime, machinesUnderMaintenance, lowStockProducts] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({ where: { priority: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] } }, take: 10, orderBy: { createdAt: 'desc' }, include: { machine: { select: { name: true } } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.downtimeLog.count({ where: { endTime: null } }),
      this.prisma.machine.count({ where: { status: 'UNDER_MAINTENANCE' } }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lte: 0 } } }),
    ])
    return { criticalRequests, overdueSchedules, currentDowntime, machinesUnderMaintenance, lowStockProducts }
  }

  async getKpis() {
    const [totalMachines, totalRequests, completedRequests, totalCounts, totalMovements] = await Promise.all([
      this.prisma.machine.count(),
      this.prisma.maintenanceRequest.count(),
      this.prisma.maintenanceRequest.count({ where: { status: 'COMPLETED' } }),
      this.prisma.inventoryCount.count(),
      this.prisma.inventoryMovement.count(),
    ])
    return { totalMachines, totalRequests, completedRequests, totalCounts, totalMovements }
  }
}
