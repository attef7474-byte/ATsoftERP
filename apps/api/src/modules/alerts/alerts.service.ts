import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, severity?: string, status?: string) {
    const skip = (page - 1) * pageSize
    const alerts: any[] = []

    const criticalRequests = await this.prisma.maintenanceRequest.findMany({
      where: { priority: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] } },
      include: { machine: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of criticalRequests) {
      alerts.push({ id: `req-${r.id}`, type: 'CRITICAL_REQUEST', severity: 'CRITICAL', status: 'ACTIVE', title: `Critical maintenance: ${r.machine?.name || 'N/A'}`, description: r.description || '', entityType: 'maintenance-request', entityId: r.id, createdAt: r.createdAt })
    }

    const currentDowntime = await this.prisma.downtimeLog.findMany({
      where: { endTime: null },
      include: { machine: { select: { name: true } } },
      orderBy: { startTime: 'desc' },
    })
    for (const d of currentDowntime) {
      alerts.push({ id: `dt-${d.id}`, type: 'DOWNTIME', severity: 'HIGH', status: 'ACTIVE', title: `Machine downtime: ${d.machine?.name || 'N/A'}`, description: d.reason || '', entityType: 'downtime-log', entityId: d.id, createdAt: d.startTime })
    }

    const lowStock = await this.prisma.inventoryBalance.findMany({
      where: { quantity: { lte: 0 } },
      include: { product: { select: { name: true } }, warehouse: { select: { name: true } } },
      take: 20,
    })
    for (const b of lowStock) {
      alerts.push({ id: `stock-${b.id}`, type: 'LOW_STOCK', severity: 'WARNING', status: 'ACTIVE', title: `Low stock: ${b.product?.name || 'N/A'} in ${b.warehouse?.name || 'N/A'}`, description: `Quantity: ${b.quantity}`, entityType: 'inventory-balance', entityId: b.id, createdAt: b.updatedAt })
    }

    const underMaintenance = await this.prisma.machine.findMany({
      where: { status: 'UNDER_MAINTENANCE' },
      take: 20,
    })
    for (const m of underMaintenance) {
      alerts.push({ id: `mnt-${m.id}`, type: 'UNDER_MAINTENANCE', severity: 'INFO', status: 'ACTIVE', title: `Machine under maintenance: ${m.name}`, description: m.notes || '', entityType: 'machine', entityId: m.id, createdAt: m.updatedAt })
    }

    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const filtered = alerts.filter(a => {
      if (severity && a.severity !== severity) return false
      if (status && a.status !== status) return false
      return true
    })

    return { data: filtered.slice(skip, skip + pageSize), total: filtered.length, page, pageSize }
  }

  async getSummary() {
    const [critical, downtime, lowStock, underMaintenance] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { priority: 'CRITICAL', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.downtimeLog.count({ where: { endTime: null } }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lte: 0 } } }),
      this.prisma.machine.count({ where: { status: 'UNDER_MAINTENANCE' } }),
    ])
    return { total: critical + downtime + lowStock + underMaintenance, critical, downtime, lowStock, underMaintenance }
  }

  async findOne(id: string) {
    return null
  }
}
