import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntityType } from './dto/search-query.dto';

export interface SearchResult {
  id: string;
  entityType: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  status: string;
  route: string;
  metadata: Record<string, any>;
}

export interface SearchGroup {
  entityType: string;
  labelKey: string;
  items: SearchResult[];
  total: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  constructor(private readonly prisma: PrismaService) {}

  async searchGlobal(q: string, types?: EntityType[], page = 1, limit = 20): Promise<SearchGroup[]> {
    const groups: SearchGroup[] = [];
    const entityList = types && types.length > 0 ? types : Object.values(EntityType);
    const pageSize = Math.min(limit, 20);

    for (const entityType of entityList) {
      const results = await this.searchEntity(entityType, q, page, pageSize);
      if (results.items.length > 0) {
        groups.push({
          entityType: entityType,
          labelKey: this.getLabelKey(entityType),
          items: results.items,
          total: results.total,
        });
      }
    }

    groups.sort((a, b) => b.total - a.total);
    return groups;
  }

  async searchEntity(entityType: EntityType, q: string, page = 1, limit = 20): Promise<{ items: SearchResult[]; total: number }> {
    const pageSize = Math.min(limit, 100);
    const skip = (page - 1) * pageSize;

    switch (entityType) {
      case EntityType.COMPANY:
        return this.searchCompanies(q, skip, pageSize);
      case EntityType.BRANCH:
        return this.searchBranches(q, skip, pageSize);
      case EntityType.DEPARTMENT:
        return this.searchDepartments(q, skip, pageSize);
      case EntityType.WAREHOUSE:
        return this.searchWarehouses(q, skip, pageSize);
      case EntityType.WAREHOUSE_LOCATION:
        return this.searchWarehouseLocations(q, skip, pageSize);
      case EntityType.PRODUCT:
        return this.searchProducts(q, skip, pageSize);
      case EntityType.MACHINE:
        return this.searchMachines(q, skip, pageSize);
      case EntityType.USER:
        return this.searchUsers(q, skip, pageSize);
      case EntityType.ROLE:
        return this.searchRoles(q, skip, pageSize);
      case EntityType.MAINTENANCE_REQUEST:
        return this.searchMaintenanceRequests(q, skip, pageSize);
      case EntityType.INVENTORY_COUNT:
        return this.searchInventoryCounts(q, skip, pageSize);
      default:
        return { items: [], total: 0 };
    }
  }

  async lookupEntity(entityType: EntityType, id: string): Promise<SearchResult | null> {
    const results = await this.searchEntity(entityType, '', 1, 1);
    const all = await this.searchEntity(entityType, '', 1, 10000);
    const found = all.items.find(item => item.id === id);
    return found || null;
  }

  async searchCompanies(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { legalName: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.company.count({ where }),
    ]);
    return {
      items: data.map(c => ({
        id: c.id, entityType: 'company', code: c.code, title: c.name,
        subtitle: c.legalName || c.code, description: c.legalName || '',
        status: c.status, route: `/admin/core/companies/${c.id}`,
        metadata: { code: c.code, legalName: c.legalName },
      })),
      total,
    };
  }

  async searchBranches(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        include: { company: { select: { name: true } } },
      }),
      this.prisma.branch.count({ where }),
    ]);
    return {
      items: data.map(b => ({
        id: b.id, entityType: 'branch', code: b.code, title: b.name,
        subtitle: b.company?.name || b.code, description: b.company?.name || '',
        status: b.status, route: `/admin/core/branches/${b.id}`,
        metadata: { code: b.code, companyName: b.company?.name },
      })),
      total,
    };
  }

  async searchDepartments(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        include: { company: { select: { name: true } }, branch: { select: { name: true } } },
      }),
      this.prisma.department.count({ where }),
    ]);
    return {
      items: data.map(d => ({
        id: d.id, entityType: 'department', code: d.code, title: d.name,
        subtitle: d.company?.name || d.code, description: d.branch?.name || '',
        status: d.status, route: `/admin/core/departments/${d.id}`,
        metadata: { code: d.code, companyName: d.company?.name, branchName: d.branch?.name },
      })),
      total,
    };
  }

  async searchWarehouses(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.warehouse.count({ where }),
    ]);
    return {
      items: data.map(w => ({
        id: w.id, entityType: 'warehouse', code: w.code, title: w.name,
        subtitle: w.code, description: '',
        status: w.status, route: `/admin/inventory/warehouses`,
        metadata: { code: w.code },
      })),
      total,
    };
  }

  async searchWarehouseLocations(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.warehouseLocation.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.warehouseLocation.count({ where }),
    ]);
    return {
      items: data.map(l => ({
        id: l.id, entityType: 'warehouseLocation', code: l.code, title: l.name,
        subtitle: l.code, description: '',
        status: l.status, route: `/admin/inventory/locations`,
        metadata: { code: l.code, warehouseId: l.warehouseId },
      })),
      total,
    };
  }

  async searchProducts(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { barcode: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        include: { category: { select: { name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: data.map(p => ({
        id: p.id, entityType: 'product', code: p.code, title: p.name,
        subtitle: p.category?.name || p.code, description: p.barcode || '',
        status: p.status, route: `/admin/inventory/products/${p.id}`,
        metadata: { code: p.code, categoryName: p.category?.name, barcode: p.barcode },
      })),
      total,
    };
  }

  async searchMachines(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { serialNumber: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        include: { category: { select: { name: true } } },
      }),
      this.prisma.machine.count({ where }),
    ]);
    return {
      items: data.map(m => ({
        id: m.id, entityType: 'machine', code: m.code, title: m.name,
        subtitle: m.category?.name || m.code, description: m.serialNumber || '',
        status: m.status, route: `/admin/maintenance/machines/${m.id}`,
        metadata: { code: m.code, categoryName: m.category?.name, serialNumber: m.serialNumber },
      })),
      total,
    };
  }

  async searchUsers(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, status: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: data.map(u => ({
        id: u.id, entityType: 'user', code: u.email, title: u.name,
        subtitle: u.email, description: '',
        status: u.status, route: `/admin/access/users/${u.id}`,
        metadata: { email: u.email },
      })),
      total,
    };
  }

  async searchRoles(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.role.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.role.count({ where }),
    ]);
    return {
      items: data.map(r => ({
        id: r.id, entityType: 'role', code: r.code, title: r.name,
        subtitle: r.code, description: r.description || '',
        status: r.status, route: `/admin/access/roles`,
        metadata: { code: r.code, description: r.description },
      })),
      total,
    };
  }

  async searchMaintenanceRequests(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { requestNumber: { contains: q } },
        { description: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { machine: { select: { name: true } } },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return {
      items: data.map(r => ({
        id: r.id, entityType: 'maintenanceRequest', code: r.requestNumber, title: r.title,
        subtitle: r.machine?.name || '', description: r.description || '',
        status: r.status, route: `/admin/maintenance/requests/${r.id}`,
        metadata: { requestNumber: r.requestNumber, machineName: r.machine?.name, priority: r.priority },
      })),
      total,
    };
  }

  async searchInventoryCounts(q: string, skip: number, take: number): Promise<{ items: SearchResult[]; total: number }> {
    const where: any = {};
    if (q) {
      where.OR = [
        { countNumber: { contains: q } },
        { notes: { contains: q } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.inventoryCount.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { warehouse: { select: { name: true } } },
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);
    return {
      items: data.map(c => ({
        id: c.id, entityType: 'inventoryCount', code: c.countNumber, title: c.countNumber,
        subtitle: c.warehouse?.name || '', description: c.notes || '',
        status: c.status, route: `/admin/inventory/counts/${c.id}`,
        metadata: { countNumber: c.countNumber, warehouseName: c.warehouse?.name },
      })),
      total,
    };
  }

  private getLabelKey(entityType: EntityType): string {
    const map: Record<string, string> = {
      company: 'core.companies',
      branch: 'core.branches',
      department: 'core.departments',
      warehouse: 'inventory.warehouses',
      warehouseLocation: 'inventory.locations.title',
      product: 'inventory.products',
      machine: 'maintenance.machines',
      user: 'access.users',
      role: 'access.roles',
      maintenanceRequest: 'maintenance.maintenanceRequests',
      inventoryCount: 'inventoryCounting.counts',
    };
    return map[entityType] || entityType;
  }

  getSearchableEntities(): { entityType: EntityType; labelKey: string }[] {
    return Object.values(EntityType).map(et => ({
      entityType: et,
      labelKey: this.getLabelKey(et),
    }));
  }
}
