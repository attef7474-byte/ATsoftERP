import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { buildDateFilter, paginate } from './report-query-utils';

@Injectable()
export class SystemReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssetsRegisterReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];
    if (filters.machineCategoryId) where.categoryId = filters.machineCategoryId;
    if (filters.status) where.status = filters.status;
    if (filters.location) where.location = { contains: filters.location };

    const [total, rows, byStatus, byCategory, activeCount, inactiveCount] = await Promise.all([
      this.prisma.machine.count({ where }),
      this.prisma.machine.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.machine.groupBy({ by: ['status'], _count: true }),
      this.prisma.machine.groupBy({ by: ['categoryId'], _count: true }),
      this.prisma.machine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.machine.count({ where: { status: 'INACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalMachines', value: total },
        { label: 'activeMachines', value: activeCount },
        { label: 'inactiveMachines', value: inactiveCount },
        { label: 'totalCategories', value: byCategory.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byCategory: byCategory.map(c => ({ categoryId: c.categoryId, count: c._count })),
    };
  }

  async getPartsReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];

    const [total, rows, highStock, lowStock] = await Promise.all([
      this.prisma.machinePart.count({ where }),
      this.prisma.machinePart.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { id: 'desc' },
      }),
      this.prisma.machinePart.count({ where: { quantity: { gte: 10 } } }),
      this.prisma.machinePart.count({ where: { quantity: { lt: 10 } } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalParts', value: total },
        { label: 'activeParts', value: highStock },
        { label: 'inactiveParts', value: lowStock },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getPartnersReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }, { email: { contains: filters.search } }];
    if (filters.type) where.type = filters.type;

    const [total, rows, byType, blockedCount, supplierCount, customerCount] = await Promise.all([
      this.prisma.businessPartner.count({ where }),
      this.prisma.businessPartner.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.businessPartner.groupBy({ by: ['type'], _count: true }),
      this.prisma.businessPartner.count({ where: { isBlocked: true } }),
      this.prisma.businessPartner.count({ where: { isSupplier: true, isBlocked: false } }),
      this.prisma.businessPartner.count({ where: { isCustomer: true, isBlocked: false } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalPartners', value: total },
        { label: 'activeSuppliers', value: supplierCount },
        { label: 'activeCustomers', value: customerCount },
        { label: 'blockedPartners', value: blockedCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
    };
  }

  async getAttachmentsReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.entityName) where.entityName = filters.entityName;
    if (filters.search) where.originalName = { contains: filters.search };

    const [total, rows, byEntityName, totalSize] = await Promise.all([
      this.prisma.attachment.count({ where }),
      this.prisma.attachment.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.attachment.groupBy({ by: ['entityName'], _count: true }),
      this.prisma.attachment.aggregate({ where, _sum: { size: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalAttachments', value: total },
        { label: 'totalAttachmentsSize', value: totalSize._sum?.size || 0, unit: 'bytes' },
        { label: 'entityTypes', value: byEntityName.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byEntityType: byEntityName.map(e => ({ entityName: e.entityName, count: e._count })),
    };
  }

  async getLowStockReport(filters: any) {
    const where: any = { quantity: { lt: 10 } };
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];

    const [total, rows, totalProducts, totalLowQty] = await Promise.all([
      this.prisma.machinePart.count({ where }),
      this.prisma.machinePart.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { quantity: 'asc' },
      }),
      this.prisma.machinePart.count(),
      this.prisma.machinePart.aggregate({ where, _sum: { quantity: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'lowStockItems', value: total },
        { label: 'totalProductCount', value: totalProducts },
        { label: 'totalLowStockQty', value: totalLowQty._sum.quantity || 0 },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }
}
