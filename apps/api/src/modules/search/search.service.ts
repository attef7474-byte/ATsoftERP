import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import {
  EntityType,
  SEARCHABLE_ENTITY_TYPES,
  SearchEntityFilters,
} from './dto/search-query.dto';

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

interface SearchDelegate {
  findMany(args: any): Promise<any[]>;
  count(args: any): Promise<number>;
  findFirst(args: any): Promise<any | null>;
}

interface SearchDefinition {
  delegate: SearchDelegate;
  where: any;
  orderBy: any;
  query?: Record<string, any>;
  map: (record: any) => SearchResult;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchGlobal(
    q: string,
    context: ActiveOperationalContext,
    types?: EntityType[],
    page = 1,
    limit = 20,
    filters: SearchEntityFilters = {},
  ): Promise<SearchGroup[]> {
    this.assertActiveContext(context);
    const entityList = types && types.length > 0 ? types : SEARCHABLE_ENTITY_TYPES;
    const pageSize = Math.min(Math.max(limit, 1), 20);

    const groups = await Promise.all(
      entityList.map(async (entityType): Promise<SearchGroup | null> => {
        const results = await this.searchEntity(entityType, q, context, page, pageSize, filters);
        if (results.items.length === 0) return null;
        return {
          entityType,
          labelKey: this.getLabelKey(entityType),
          items: results.items,
          total: results.total,
        };
      }),
    );

    return groups
      .filter((group): group is SearchGroup => group !== null)
      .sort((a, b) => b.total - a.total);
  }

  async searchEntity(
    entityType: EntityType,
    q: string,
    context: ActiveOperationalContext,
    page = 1,
    limit = 20,
    filters: SearchEntityFilters = {},
  ): Promise<{ items: SearchResult[]; total: number }> {
    this.assertActiveContext(context);
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const definition = this.getDefinition(entityType, q, context, filters);
    if (!definition) return { items: [], total: 0 };

    const baseArgs = {
      where: definition.where,
      ...definition.query,
    };
    const [data, total] = await Promise.all([
      definition.delegate.findMany({
        ...baseArgs,
        skip: (safePage - 1) * pageSize,
        take: pageSize,
        orderBy: definition.orderBy,
      }),
      definition.delegate.count({ where: definition.where }),
    ]);

    return { items: data.map(definition.map), total };
  }

  async lookupEntity(
    entityType: EntityType,
    id: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters = {},
  ): Promise<SearchResult | null> {
    this.assertActiveContext(context);
    const definition = this.getDefinition(entityType, '', context, filters);
    if (!definition) return null;

    const record = await definition.delegate.findFirst({
      where: this.and(definition.where, { id }),
      ...definition.query,
    });
    return record ? definition.map(record) : null;
  }

  private getDefinition(
    entityType: EntityType,
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition | null {
    switch (entityType) {
      case EntityType.COMPANY:
        return this.companyDefinition(q, context);
      case EntityType.BRANCH:
        return this.branchDefinition(q, context);
      case EntityType.ADMINISTRATION:
        return this.administrationDefinition(q, context, filters);
      case EntityType.DEPARTMENT:
        return this.departmentDefinition(q, context, filters);
      case EntityType.WAREHOUSE:
        return this.warehouseDefinition(q, context, filters);
      case EntityType.WAREHOUSE_LOCATION:
        return this.warehouseLocationDefinition(q, context, filters);
      case EntityType.PRODUCT:
        return this.productDefinition(q, context, filters);
      case EntityType.MACHINE:
        return this.machineDefinition(q, context, filters);
      case EntityType.USER:
        return this.userDefinition(q, context, filters);
      case EntityType.ROLE:
        return this.roleDefinition(q);
      case EntityType.MAINTENANCE_REQUEST:
        return this.maintenanceRequestDefinition(q, context, filters);
      case EntityType.INVENTORY_COUNT:
        return this.inventoryCountDefinition(q, context, filters);
      case EntityType.PRODUCTION_LINE:
        return this.productionLineDefinition(q, context, filters);
      case EntityType.COST_CENTER:
        return this.costCenterDefinition(q, context, filters);
      case EntityType.OPERATION_TYPE:
        return this.operationTypeDefinition(q, context, filters);
      case EntityType.MACHINE_COMPONENT:
      case EntityType.COMPONENT:
        return this.machineComponentDefinition(q, context, filters);
      case EntityType.SPARE_PART:
        return this.sparePartDefinition(q, context, filters);
      default:
        return null;
    }
  }

  private companyDefinition(q: string, context: ActiveOperationalContext): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.company),
      where: this.and(
        { id: context.companyId, status: 'ACTIVE', deletedAt: null },
        this.textSearch(q, ['name', 'code', 'legalName']),
      ),
      orderBy: { name: 'asc' },
      map: (company) => ({
        id: company.id,
        entityType: EntityType.COMPANY,
        code: company.code,
        title: company.name,
        subtitle: company.legalName || company.code,
        description: company.legalName || '',
        status: company.status,
        route: `/admin/core/companies/${company.id}`,
        metadata: { code: company.code, legalName: company.legalName },
      }),
    };
  }

  private branchDefinition(q: string, context: ActiveOperationalContext): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.branch),
      where: this.and(
        {
          id: context.branchId,
          companyId: context.companyId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        this.textSearch(q, ['name', 'code']),
      ),
      orderBy: { name: 'asc' },
      query: { include: { company: { select: { name: true } } } },
      map: (branch) => ({
        id: branch.id,
        entityType: EntityType.BRANCH,
        code: branch.code,
        title: branch.name,
        subtitle: branch.company?.name || branch.code,
        description: branch.company?.name || '',
        status: branch.status,
        route: `/admin/core/branches/${branch.id}`,
        metadata: {
          code: branch.code,
          companyId: branch.companyId,
          companyName: branch.company?.name,
        },
      }),
    };
  }

  private administrationDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.administration),
      where: this.and(
        {
          branchId: context.branchId,
          status: 'ACTIVE',
          deletedAt: null,
          branch: { companyId: context.companyId },
        },
        context.administrationId ? { id: context.administrationId } : undefined,
        filters.administrationId ? { id: filters.administrationId } : undefined,
        this.textSearch(q, ['name', 'code', 'description']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          branch: { select: { id: true, name: true, companyId: true } },
        },
      },
      map: (administration) => ({
        id: administration.id,
        entityType: EntityType.ADMINISTRATION,
        code: administration.code,
        title: administration.name,
        subtitle: administration.branch?.name || administration.code,
        description: administration.description || '',
        status: administration.status,
        route: '/admin/core/administrations',
        metadata: {
          code: administration.code,
          branchId: administration.branchId,
          branchName: administration.branch?.name,
        },
      }),
    };
  }

  private departmentDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.department),
      where: this.and(
        {
          companyId: context.companyId,
          branchId: context.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        context.administrationId
          ? { administrationId: context.administrationId }
          : undefined,
        context.departmentId ? { id: context.departmentId } : undefined,
        filters.administrationId
          ? { administrationId: filters.administrationId }
          : undefined,
        filters.departmentId ? { id: filters.departmentId } : undefined,
        this.textSearch(q, ['name', 'code']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          company: { select: { name: true } },
          branch: { select: { name: true } },
          administration: { select: { name: true } },
        },
      },
      map: (department) => ({
        id: department.id,
        entityType: EntityType.DEPARTMENT,
        code: department.code,
        title: department.name,
        subtitle: department.company?.name || department.code,
        description: department.branch?.name || '',
        status: department.status,
        route: `/admin/core/departments/${department.id}`,
        metadata: {
          code: department.code,
          companyId: department.companyId,
          companyName: department.company?.name,
          branchId: department.branchId,
          branchName: department.branch?.name,
          administrationId: department.administrationId,
          administrationName: department.administration?.name,
        },
      }),
    };
  }

  private warehouseDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.warehouse),
      where: this.and(
        this.warehouseScope(context),
        filters.warehouseId ? { id: filters.warehouseId } : undefined,
        this.textSearch(q, ['name', 'code', 'location']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          company: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      map: (warehouse) => ({
        id: warehouse.id,
        entityType: EntityType.WAREHOUSE,
        code: warehouse.code,
        title: warehouse.name,
        subtitle: warehouse.code,
        description: warehouse.location || '',
        status: warehouse.status,
        route: '/admin/inventory/warehouses',
        metadata: {
          code: warehouse.code,
          companyId: warehouse.companyId,
          companyName: warehouse.company?.name,
          branchId: warehouse.branchId,
          branchName: warehouse.branch?.name,
          warehouseType: warehouse.warehouseType,
        },
      }),
    };
  }

  private warehouseLocationDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.warehouseLocation),
      where: this.and(
        {
          status: 'ACTIVE',
          warehouse: this.and(
            this.warehouseScope(context),
            filters.warehouseId ? { id: filters.warehouseId } : undefined,
          ),
        },
        this.textSearch(q, ['name', 'code', 'barcode']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
        },
      },
      map: (location) => ({
        id: location.id,
        entityType: EntityType.WAREHOUSE_LOCATION,
        code: location.code,
        title: location.name,
        subtitle: location.warehouse?.name || location.code,
        description: location.barcode || '',
        status: location.status,
        route: '/admin/inventory/locations',
        metadata: {
          code: location.code,
          barcode: location.barcode,
          warehouseId: location.warehouseId,
          warehouseCode: location.warehouse?.code,
          warehouseName: location.warehouse?.name,
        },
      }),
    };
  }

  private productDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    const warehouseConstraint = filters.warehouseId
      ? {
          balances: {
            some: {
              warehouseId: filters.warehouseId,
              warehouse: this.warehouseScope(context),
            },
          },
        }
      : undefined;

    return {
      delegate: this.delegate(this.prisma.product),
      where: this.and(
        { status: 'ACTIVE', deletedAt: null },
        warehouseConstraint,
        this.textSearch(q, ['name', 'code', 'barcode', 'description']),
      ),
      orderBy: { name: 'asc' },
      query: { include: { category: { select: { name: true } } } },
      map: (product) => ({
        id: product.id,
        entityType: EntityType.PRODUCT,
        code: product.code,
        title: product.name,
        subtitle: product.category?.name || product.code,
        description: product.barcode || product.description || '',
        status: product.status,
        route: `/admin/inventory/products/${product.id}`,
        metadata: {
          code: product.code,
          categoryName: product.category?.name,
          barcode: product.barcode,
          unit: product.unit,
          scope: 'GLOBAL_CATALOG',
        },
      }),
    };
  }

  private machineDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.machine),
      where: this.and(
        this.machineScope(context),
        filters.machineId ? { id: filters.machineId } : undefined,
        filters.administrationId
          ? this.machineAdministrationScope(filters.administrationId)
          : undefined,
        filters.departmentId ? { departmentId: filters.departmentId } : undefined,
        filters.productionLineId
          ? { productionLineId: filters.productionLineId }
          : undefined,
        filters.operationTypeId
          ? { operationTypeId: filters.operationTypeId }
          : undefined,
        filters.costCenterId
          ? { defaultCostCenterId: filters.costCenterId }
          : undefined,
        this.textSearch(q, ['name', 'code', 'serialNumber', 'model', 'manufacturer']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          category: { select: { name: true } },
          productionLine: { select: { id: true, name: true } },
          operationType: { select: { id: true, name: true } },
          defaultCostCenter: { select: { id: true, name: true } },
        },
      },
      map: (machine) => ({
        id: machine.id,
        entityType: EntityType.MACHINE,
        code: machine.code,
        title: machine.name,
        subtitle: machine.category?.name || machine.code,
        description: machine.serialNumber || machine.model || '',
        status: machine.status,
        route: `/admin/maintenance/machines/${machine.id}`,
        metadata: {
          code: machine.code,
          categoryName: machine.category?.name,
          serialNumber: machine.serialNumber,
          companyId: machine.companyId,
          branchId: machine.branchId,
          departmentId: machine.departmentId,
          productionLineId: machine.productionLineId,
          productionLineName: machine.productionLine?.name,
          operationTypeId: machine.operationTypeId,
          operationTypeName: machine.operationType?.name,
          costCenterId: machine.defaultCostCenterId,
          costCenterName: machine.defaultCostCenter?.name,
        },
      }),
    };
  }

  private userDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.user),
      where: this.and(
        {
          companyId: context.companyId,
          branchId: context.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        context.administrationId
          ? { department: { administrationId: context.administrationId } }
          : undefined,
        context.departmentId ? { departmentId: context.departmentId } : undefined,
        filters.administrationId
          ? { department: { administrationId: filters.administrationId } }
          : undefined,
        filters.departmentId ? { departmentId: filters.departmentId } : undefined,
        this.textSearch(q, ['name', 'email', 'phone']),
      ),
      orderBy: { name: 'asc' },
      query: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          companyId: true,
          branchId: true,
          departmentId: true,
        },
      },
      map: (user) => ({
        id: user.id,
        entityType: EntityType.USER,
        code: user.email,
        title: user.name,
        subtitle: user.email,
        description: user.phone || '',
        status: user.status,
        route: `/admin/access/users/${user.id}`,
        metadata: {
          email: user.email,
          companyId: user.companyId,
          branchId: user.branchId,
          departmentId: user.departmentId,
        },
      }),
    };
  }

  private roleDefinition(q: string): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.role),
      where: this.and(
        { status: 'ACTIVE', deletedAt: null },
        this.textSearch(q, ['name', 'code', 'description']),
      ),
      orderBy: { name: 'asc' },
      map: (role) => ({
        id: role.id,
        entityType: EntityType.ROLE,
        code: role.code,
        title: role.name,
        subtitle: role.code,
        description: role.description || '',
        status: role.status,
        route: '/admin/access/roles',
        metadata: {
          code: role.code,
          description: role.description,
          scope: 'GLOBAL_CATALOG',
        },
      }),
    };
  }

  private maintenanceRequestDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.maintenanceRequest),
      where: this.and(
        {
          deletedAt: null,
          machine: this.and(
            this.machineScope(context),
            filters.machineId ? { id: filters.machineId } : undefined,
          ),
        },
        filters.productionLineId
          ? { productionLineId: filters.productionLineId }
          : undefined,
        filters.operationTypeId
          ? { operationTypeId: filters.operationTypeId }
          : undefined,
        filters.costCenterId ? { costCenterId: filters.costCenterId } : undefined,
        filters.machineComponentId || filters.componentId
          ? {
              machineComponentId:
                filters.machineComponentId || filters.componentId,
            }
          : undefined,
        this.textSearch(q, ['title', 'requestNumber', 'description', 'notes']),
      ),
      orderBy: { createdAt: 'desc' },
      query: {
        include: {
          machine: { select: { id: true, name: true } },
          machineComponent: { select: { id: true, name: true } },
        },
      },
      map: (request) => ({
        id: request.id,
        entityType: EntityType.MAINTENANCE_REQUEST,
        code: request.requestNumber,
        title: request.title,
        subtitle: request.machine?.name || '',
        description: request.description || '',
        status: request.status,
        route: `/admin/maintenance/requests/${request.id}`,
        metadata: {
          requestNumber: request.requestNumber,
          machineId: request.machineId,
          machineName: request.machine?.name,
          machineComponentId: request.machineComponentId,
          machineComponentName: request.machineComponent?.name,
          priority: request.priority,
        },
      }),
    };
  }

  private inventoryCountDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.inventoryCount),
      where: this.and(
        {
          companyId: context.companyId,
          branchId: context.branchId,
          deletedAt: null,
          warehouse: this.warehouseScope(context),
        },
        filters.warehouseId ? { warehouseId: filters.warehouseId } : undefined,
        this.textSearch(q, ['countNumber', 'notes']),
      ),
      orderBy: { createdAt: 'desc' },
      query: {
        include: { warehouse: { select: { id: true, name: true } } },
      },
      map: (count) => ({
        id: count.id,
        entityType: EntityType.INVENTORY_COUNT,
        code: count.countNumber,
        title: count.countNumber,
        subtitle: count.warehouse?.name || '',
        description: count.notes || '',
        status: count.status,
        route: `/admin/inventory/counts/${count.id}`,
        metadata: {
          countNumber: count.countNumber,
          companyId: count.companyId,
          branchId: count.branchId,
          warehouseId: count.warehouseId,
          warehouseName: count.warehouse?.name,
        },
      }),
    };
  }

  private productionLineDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.productionLine),
      where: this.and(
        {
          companyId: context.companyId,
          branchId: context.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        context.administrationId
          ? { administrationId: context.administrationId }
          : undefined,
        context.departmentId
          ? { departmentId: context.departmentId }
          : undefined,
        filters.administrationId
          ? { administrationId: filters.administrationId }
          : undefined,
        filters.departmentId ? { departmentId: filters.departmentId } : undefined,
        filters.productionLineId ? { id: filters.productionLineId } : undefined,
        filters.operationTypeId
          ? { operationTypeId: filters.operationTypeId }
          : undefined,
        filters.costCenterId ? { costCenterId: filters.costCenterId } : undefined,
        this.textSearch(q, ['name', 'code', 'description', 'location']),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          department: { select: { id: true, name: true } },
          operationType: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
        },
      },
      map: (line) => ({
        id: line.id,
        entityType: EntityType.PRODUCTION_LINE,
        code: line.code,
        title: line.name,
        subtitle: line.department?.name || line.code,
        description: line.description || line.location || '',
        status: line.status,
        route: '/admin/maintenance/production-lines',
        metadata: {
          code: line.code,
          companyId: line.companyId,
          branchId: line.branchId,
          administrationId: line.administrationId,
          departmentId: line.departmentId,
          departmentName: line.department?.name,
          operationTypeId: line.operationTypeId,
          operationTypeName: line.operationType?.name,
          costCenterId: line.costCenterId,
          costCenterName: line.costCenter?.name,
        },
      }),
    };
  }

  private costCenterDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    return {
      delegate: this.delegate(this.prisma.costCenter),
      where: this.and(
        {
          companyId: context.companyId,
          branchId: context.branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        context.administrationId
          ? { administrationId: context.administrationId }
          : undefined,
        context.departmentId
          ? { departmentId: context.departmentId }
          : undefined,
        filters.administrationId
          ? { administrationId: filters.administrationId }
          : undefined,
        filters.departmentId ? { departmentId: filters.departmentId } : undefined,
        filters.costCenterId ? { id: filters.costCenterId } : undefined,
        this.textSearch(q, ['name', 'code', 'description', 'type']),
      ),
      orderBy: { name: 'asc' },
      map: (costCenter) => ({
        id: costCenter.id,
        entityType: EntityType.COST_CENTER,
        code: costCenter.code,
        title: costCenter.name,
        subtitle: costCenter.type || costCenter.code,
        description: costCenter.description || '',
        status: costCenter.status,
        route: '/admin/maintenance/cost-centers',
        metadata: {
          code: costCenter.code,
          type: costCenter.type,
          companyId: costCenter.companyId,
          branchId: costCenter.branchId,
          administrationId: costCenter.administrationId,
          departmentId: costCenter.departmentId,
        },
      }),
    };
  }

  private operationTypeDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    const productionLineConstraint =
      filters.productionLineId ||
      filters.administrationId ||
      filters.departmentId
        ? {
            productionLines: {
              some: this.and(
                {
                  companyId: context.companyId,
                  branchId: context.branchId,
                  status: 'ACTIVE',
                  deletedAt: null,
                },
                context.administrationId
                  ? { administrationId: context.administrationId }
                  : undefined,
                context.departmentId
                  ? { departmentId: context.departmentId }
                  : undefined,
                filters.administrationId
                  ? { administrationId: filters.administrationId }
                  : undefined,
                filters.departmentId
                  ? { departmentId: filters.departmentId }
                  : undefined,
                filters.productionLineId
                  ? { id: filters.productionLineId }
                  : undefined,
              ),
            },
          }
        : undefined;

    return {
      delegate: this.delegate(this.prisma.operationType),
      where: this.and(
        { status: 'ACTIVE', deletedAt: null },
        filters.operationTypeId ? { id: filters.operationTypeId } : undefined,
        productionLineConstraint,
        this.textSearch(q, ['name', 'code', 'description']),
      ),
      orderBy: { name: 'asc' },
      map: (operationType) => ({
        id: operationType.id,
        entityType: EntityType.OPERATION_TYPE,
        code: operationType.code,
        title: operationType.name,
        subtitle: operationType.code,
        description: operationType.description || '',
        status: operationType.status,
        route: '/admin/maintenance/operation-types',
        metadata: {
          code: operationType.code,
          scope: 'GLOBAL_CATALOG',
        },
      }),
    };
  }

  private machineComponentDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    const componentId = filters.machineComponentId || filters.componentId;
    return {
      delegate: this.delegate(this.prisma.machineComponent),
      where: this.and(
        {
          status: 'ACTIVE',
          deletedAt: null,
          machine: this.and(
            this.machineScope(context),
            filters.machineId ? { id: filters.machineId } : undefined,
          ),
        },
        componentId ? { id: componentId } : undefined,
        this.textSearch(q, [
          'name',
          'code',
          'description',
          'serialNumber',
          'manufacturer',
          'model',
        ]),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: { machine: { select: { id: true, code: true, name: true } } },
      },
      map: (component) => ({
        id: component.id,
        entityType: EntityType.MACHINE_COMPONENT,
        code: component.code,
        title: component.name,
        subtitle: component.machine?.name || component.componentType,
        description: component.description || '',
        status: component.status,
        route: `/admin/maintenance/machine-components/${component.id}`,
        metadata: {
          code: component.code,
          componentType: component.componentType,
          criticality: component.criticality,
          machineId: component.machineId,
          machineCode: component.machine?.code,
          machineName: component.machine?.name,
        },
      }),
    };
  }

  private sparePartDefinition(
    q: string,
    context: ActiveOperationalContext,
    filters: SearchEntityFilters,
  ): SearchDefinition {
    const componentId = filters.machineComponentId || filters.componentId;
    const machineConstraint = filters.machineId
      ? {
          OR: [
            {
              machineLinks: {
                some: {
                  machineId: filters.machineId,
                  status: 'ACTIVE',
                  machine: this.machineScope(context),
                },
              },
            },
            {
              componentLinks: {
                some: {
                  status: 'ACTIVE',
                  component: {
                    machineId: filters.machineId,
                    machine: this.machineScope(context),
                  },
                },
              },
            },
          ],
        }
      : undefined;
    const componentConstraint = componentId
      ? {
          componentLinks: {
            some: {
              componentId,
              status: 'ACTIVE',
              component: { machine: this.machineScope(context) },
            },
          },
        }
      : undefined;
    const warehouseConstraint = filters.warehouseId
      ? {
          OR: [
            {
              conditionBalances: {
                some: {
                  warehouseId: filters.warehouseId,
                  warehouse: this.warehouseScope(context),
                  availableQuantity: { gt: 0 },
                },
              },
            },
            {
              product: {
                balances: {
                  some: {
                    warehouseId: filters.warehouseId,
                    warehouse: this.warehouseScope(context),
                    quantity: { gt: 0 },
                  },
                },
              },
            },
          ],
        }
      : undefined;

    return {
      delegate: this.delegate(this.prisma.sparePart),
      where: this.and(
        { status: 'ACTIVE', deletedAt: null },
        machineConstraint,
        componentConstraint,
        warehouseConstraint,
        this.textSearch(q, [
          'name',
          'code',
          'description',
          'partNumber',
          'barcode',
          'manufacturer',
          'model',
        ]),
      ),
      orderBy: { name: 'asc' },
      query: {
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
        },
      },
      map: (sparePart) => ({
        id: sparePart.id,
        entityType: EntityType.SPARE_PART,
        code: sparePart.code,
        title: sparePart.name,
        subtitle: sparePart.partNumber || sparePart.category || sparePart.code,
        description: sparePart.description || '',
        status: sparePart.status,
        route: `/admin/maintenance/spare-parts/${sparePart.id}`,
        metadata: {
          code: sparePart.code,
          partNumber: sparePart.partNumber,
          category: sparePart.category,
          unit: sparePart.unit || sparePart.product?.unit,
          productId: sparePart.productId,
          productCode: sparePart.product?.code,
          productName: sparePart.product?.name,
          scope: 'GLOBAL_CATALOG',
        },
      }),
    };
  }

  private machineScope(context: ActiveOperationalContext): any {
    return this.and(
      {
        companyId: context.companyId,
        branchId: context.branchId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      context.administrationId
        ? this.machineAdministrationScope(context.administrationId)
        : undefined,
      context.departmentId ? { departmentId: context.departmentId } : undefined,
    );
  }

  private machineAdministrationScope(administrationId: string): any {
    return {
      OR: [
        { technicalAdministrationId: administrationId },
        { department: { administrationId } },
        { productionLine: { administrationId } },
      ],
    };
  }

  private warehouseScope(context: ActiveOperationalContext): any {
    return {
      companyId: context.companyId,
      branchId: context.branchId,
      status: 'ACTIVE',
      deletedAt: null,
    };
  }

  private textSearch(q: string, fields: string[]): any | undefined {
    const term = q.trim();
    if (!term) return undefined;
    return {
      OR: fields.map((field) => ({ [field]: { contains: term } })),
    };
  }

  private and(...conditions: Array<any | undefined | null | false>): any {
    const filtered = conditions.filter(Boolean);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { AND: filtered };
  }

  private delegate(value: unknown): SearchDelegate {
    return value as SearchDelegate;
  }

  private assertActiveContext(context: ActiveOperationalContext): void {
    if (!context?.companyId || !context?.branchId) {
      throw new ForbiddenException({
        messageKey: 'common.forbidden',
        message: 'Active operational context is required',
      });
    }
  }

  private getLabelKey(entityType: EntityType): string {
    const map: Record<string, string> = {
      [EntityType.COMPANY]: 'core.companies',
      [EntityType.BRANCH]: 'core.branches',
      [EntityType.ADMINISTRATION]: 'core.administrations',
      [EntityType.DEPARTMENT]: 'core.departments',
      [EntityType.WAREHOUSE]: 'inventory.warehouses',
      [EntityType.WAREHOUSE_LOCATION]: 'inventory.locations.title',
      [EntityType.PRODUCT]: 'inventory.products',
      [EntityType.MACHINE]: 'maintenance.machines',
      [EntityType.USER]: 'access.users',
      [EntityType.ROLE]: 'access.roles',
      [EntityType.MAINTENANCE_REQUEST]: 'maintenance.maintenanceRequests',
      [EntityType.INVENTORY_COUNT]: 'inventoryCounting.counts',
      [EntityType.PRODUCTION_LINE]: 'maintenance.productionLines',
      [EntityType.COST_CENTER]: 'maintenance.costCenters',
      [EntityType.OPERATION_TYPE]: 'maintenance.operationTypes',
      [EntityType.MACHINE_COMPONENT]: 'maintenance.machineComponents',
      [EntityType.COMPONENT]: 'maintenance.machineComponents',
      [EntityType.SPARE_PART]: 'maintenance.spareParts',
    };
    return map[entityType] || entityType;
  }

  getSearchableEntities(): { entityType: EntityType; labelKey: string }[] {
    return SEARCHABLE_ENTITY_TYPES.map((entityType) => ({
      entityType,
      labelKey: this.getLabelKey(entityType),
    }));
  }
}
