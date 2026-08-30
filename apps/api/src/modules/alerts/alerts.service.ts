import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types'

const LIFE_ALERT_SEVERITY: Record<string, string> = {
  WARNING: 'WARNING',
  DUE: 'HIGH',
  EXPIRED: 'CRITICAL',
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    }
  }

  private warehouseScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    }
  }

  async findAll(page = 1, pageSize = 20, severity?: string, status?: string, ctx?: ActiveOperationalContext) {
    const skip = (page - 1) * pageSize
    const alerts: any[] = []
    const machineWhere = ctx ? this.machineScope(ctx) : undefined

    const criticalRequests = await this.prisma.maintenanceRequest.findMany({
      where: { priority: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] }, ...(machineWhere ? { machine: machineWhere } : {}) },
      include: { machine: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of criticalRequests) {
      alerts.push({ id: `req-${r.id}`, type: 'CRITICAL_REQUEST', severity: 'CRITICAL', status: 'ACTIVE', title: `Critical maintenance: ${r.machine?.name || 'N/A'}`, description: r.description || '', entityType: 'maintenance-request', entityId: r.id, createdAt: r.createdAt })
    }

    const currentDowntime = await this.prisma.downtimeLog.findMany({
      where: { endTime: null, ...(machineWhere ? { machine: machineWhere } : {}) },
      include: { machine: { select: { name: true } } },
      orderBy: { startTime: 'desc' },
    })
    for (const d of currentDowntime) {
      alerts.push({ id: `dt-${d.id}`, type: 'DOWNTIME', severity: 'HIGH', status: 'ACTIVE', title: `Machine downtime: ${d.machine?.name || 'N/A'}`, description: d.reason || '', entityType: 'downtime-log', entityId: d.id, createdAt: d.startTime })
    }

    const lowStock = await this.prisma.inventoryBalance.findMany({
      where: { quantity: { lte: 0 }, ...(ctx ? { warehouse: this.warehouseScope(ctx) } : {}) },
      include: { product: { select: { name: true } }, warehouse: { select: { name: true } } },
      take: 20,
    })
    for (const b of lowStock) {
      alerts.push({ id: `stock-${b.id}`, type: 'LOW_STOCK', severity: 'WARNING', status: 'ACTIVE', title: `Low stock: ${b.product?.name || 'N/A'} in ${b.warehouse?.name || 'N/A'}`, description: `Quantity: ${b.quantity}`, entityType: 'inventory-balance', entityId: b.id, createdAt: b.updatedAt })
    }

    const underMaintenance = await this.prisma.machine.findMany({
      where: { status: 'UNDER_MAINTENANCE', ...(machineWhere ? machineWhere : {}) },
      take: 20,
    })
    for (const m of underMaintenance) {
      alerts.push({ id: `mnt-${m.id}`, type: 'UNDER_MAINTENANCE', severity: 'INFO', status: 'ACTIVE', title: `Machine under maintenance: ${m.name}`, description: m.notes || '', entityType: 'machine', entityId: m.id, createdAt: m.updatedAt })
    }

    const lifeAlertParts = await this.prisma.machineInstalledPart.findMany({
      where: {
        status: 'ACTIVE',
        alertThresholdReached: { in: ['WARNING', 'DUE', 'EXPIRED'] },
        ...(machineWhere ? { machine: machineWhere } : {}),
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
      },
      orderBy: { expectedLifeAlertAt: 'desc' },
    })
    for (const p of lifeAlertParts) {
      const severityValue = LIFE_ALERT_SEVERITY[p.alertThresholdReached || 'WARNING'] || 'WARNING'
      alerts.push({
        id: `life-${p.id}`,
        type: 'EXPECTED_LIFE',
        severity: severityValue,
        status: 'ACTIVE',
        title: `Expected life ${p.alertThresholdReached?.toLowerCase()}: ${p.sparePart?.name || 'N/A'} on ${p.machine?.name || 'N/A'}`,
        description: `Part ${p.sparePart?.name || 'N/A'} on ${p.machineComponent?.name || 'machine'} has reached the ${p.alertThresholdReached?.toLowerCase()} threshold`,
        entityType: 'machine-installed-part',
        entityId: p.id,
        createdAt: p.expectedLifeAlertAt || p.updatedAt || p.createdAt,
      })
    }

    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const filtered = alerts.filter(a => {
      if (severity && a.severity !== severity) return false
      if (status && a.status !== status) return false
      return true
    })

    return { data: filtered.slice(skip, skip + pageSize), total: filtered.length, page, pageSize }
  }

  async getSummary(ctx?: ActiveOperationalContext, userId?: string) {
    const machineWhere = ctx ? this.machineScope(ctx) : undefined
    const [critical, downtime, lowStock, underMaintenance, expectedLife, unreadNotifications, slaOverdue, slaEscalated] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { priority: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] }, ...(machineWhere ? { machine: machineWhere } : {}) } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, ...(machineWhere ? { machine: machineWhere } : {}) } }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lte: 0 }, ...(ctx ? { warehouse: this.warehouseScope(ctx) } : {}) } }),
      this.prisma.machine.count({ where: { status: 'UNDER_MAINTENANCE', ...(machineWhere ? machineWhere : {}) } }),
      this.prisma.machineInstalledPart.count({ where: { status: 'ACTIVE', alertThresholdReached: { in: ['WARNING', 'DUE', 'EXPIRED'] }, ...(machineWhere ? { machine: machineWhere } : {}) } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null, slaStatus: 'OVERDUE', ...(machineWhere ? { machine: machineWhere } : {}) } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null, escalationLevel: { not: 'NONE' }, ...(machineWhere ? { machine: machineWhere } : {}) } }),
    ])
    return { total: critical + downtime + lowStock + underMaintenance + expectedLife, critical, downtime, lowStock, underMaintenance, expectedLife, unreadNotifications, slaOverdue, slaEscalated }
  }

  async findOne(id: string, ctx?: ActiveOperationalContext) {
    const list = await this.findAll(1, 500, undefined, undefined, ctx)
    const alert = list.data.find((a: any) => a.id === id)
    if (!alert) throw new NotFoundException({ messageKey: 'alerts.alertNotFound', message: 'Alert not found' })
    return alert
  }
}
