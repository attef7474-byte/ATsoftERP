import { IssueVoucherQueryDto } from './dto/issue-voucher-query.dto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { WarehouseApprovalsQueryDto } from './dto/warehouse-approvals-query.dto';
import { IssueType, normalizeIssueTypeInput } from './issue-selection.policy';

export type WarehouseApprovalType = IssueType;
export type WarehouseApprovalAuthority = 'MAINTENANCE_REQUEST_PART' | 'SPARE_PART_ISSUE' | 'FLAT' | 'GENERAL_INVENTORY_ISSUE';

export interface WarehouseApprovalRow {
  key: string;
  type: WarehouseApprovalType;
  /** Native authority that owns the row and therefore its action endpoints. */
  authority: WarehouseApprovalAuthority;
  entityId: string;
  /**
   * Id of the owning parent record when the actionable endpoint is nested under
   * it (spare-part lines live under a maintenance request). Null for flat
   * authorities where `entityId` is the actionable id.
   */
  parentEntityId: string | null;
  /** User-facing reference (never a raw id). */
  reference: string;
  title: string | null;
  status: string;
  requestedAt: Date | null;
  requestedById: string | null;
  requestedByName: string | null;
  warehouse: { id: string; code: string; name: string } | null;
  lineCount: number;
  totalQuantity: number;
  createdAt: Date;
  documentDate: Date;
  sourceType: string | null;
}

const SPARE_PART_READ = 'maintenance-request-parts:read';
const SPARE_PART_ISSUE_READ = 'spare-part-issue:read';
const RAW_MATERIAL_READ = 'production-material-document:read';
const FINISHED_GOODS_READ = 'finished-goods-issue:read';
const GENERAL_ISSUE_READ = 'general-inventory-issue:read';

/**
 * Permissions the unified approvals page may surface. These are informational
 * mirrors of real, existing permission keys — action buttons still call the
 * native endpoints where the real guard decides. There is deliberately no
 * umbrella permission that grants any underlying action.
 */
const REPORTABLE_PERMISSION_KEYS = [
  SPARE_PART_READ,
  'maintenance-request-parts:approve',
  'maintenance-request-parts:reject',
  'maintenance-request-parts:request',
  SPARE_PART_ISSUE_READ,
  'spare-part-issue:approve',
  'spare-part-issue:reject',
  'spare-part-issue:withdraw',
  'spare-part-issue:cancel-approval',
  RAW_MATERIAL_READ,
  'production-material-document:approve',
  'production-material-document:reject',
  'production-material-document:withdraw',
  'production-material-document:post',
  FINISHED_GOODS_READ,
  'finished-goods-issue:approve',
  'finished-goods-issue:reject',
  'finished-goods-issue:withdraw',
  'finished-goods-issue:post',
  GENERAL_ISSUE_READ,
  'general-inventory-issue:approve',
  'general-inventory-issue:reject',
  'general-inventory-issue:withdraw',
  'general-inventory-issue:post',
  'general-inventory-issue:reverse',
];

/**
 * Read-only aggregation over the native issue-request authorities (maintenance
 * request lines, standalone spare-part issues, raw materials and finished
 * goods). It is a compatibility/inbox view, never a second source of truth:
 * every row is read from its own tenant-scoped model and every action is
 * performed through that model's native endpoint.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveGrantedPermissions(userId: string): Promise<{ isSuperAdmin: boolean; keys: Set<string> }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const keys = new Set<string>();
    let isSuperAdmin = false;
    for (const userRole of userRoles) {
      if (userRole.role?.status !== 'ACTIVE') continue;
      if (userRole.role.code === 'SUPER_ADMIN') {
        isSuperAdmin = true;
        continue;
      }
      for (const rolePermission of userRole.role.permissions ?? []) {
        if (rolePermission.permission?.status === 'ACTIVE') keys.add(rolePermission.permission.key);
      }
    }
    return { isSuperAdmin, keys };
  }

  private can(grant: { isSuperAdmin: boolean; keys: Set<string> }, permission: string): boolean {
    return grant.isSuperAdmin || grant.keys.has(permission);
  }

  private pendingStatus(status?: string): string {
    return status && ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(status) ? status : 'SUBMITTED';
  }

  /**
   * Spare-part request lines use REQUESTED as their native "awaiting warehouse
   * decision" status, while the flat authorities use SUBMITTED. The inbox keeps
   * one API vocabulary (SUBMITTED/APPROVED/REJECTED) and translates it per
   * family, so a row always carries its own native status.
   */
  private sparePartStatus(status: string): string {
    return status === 'SUBMITTED' ? 'REQUESTED' : status;
  }

  async list(query: WarehouseApprovalsQueryDto | IssueVoucherQueryDto, userId: string, ctx: ActiveOperationalContext, issues = false) {
    const grant = await this.resolveGrantedPermissions(userId);
    const readableMaintenanceParts = this.can(grant, SPARE_PART_READ);
    const readableSparePartIssues = this.can(grant, SPARE_PART_ISSUE_READ);
    // Either native spare-part read permission opens the unified inbox.
    const readableSpareParts = readableMaintenanceParts || readableSparePartIssues;
    const readableRawMaterials = this.can(grant, RAW_MATERIAL_READ);
    const readableFinishedGoods = this.can(grant, FINISHED_GOODS_READ);
    const readableGeneralIssues = this.can(grant, GENERAL_ISSUE_READ);
    if (!readableSpareParts && !readableRawMaterials && !readableFinishedGoods && !readableGeneralIssues) {
      throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    if (!ctx?.companyId || !ctx?.branchId) throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions' });
    const filters = query as IssueVoucherQueryDto;
    const status = issues ? query.status : this.pendingStatus(query.status);
    const type = normalizeIssueTypeInput(query.type);
    // Bounded cross-model page: each family contributes at most page*limit rows,
    // which is enough to build the requested global page without unbounded reads.
    const takePerFamily = page * limit;
    const search = query.search?.trim();
    const dateFilter = query.dateFrom || query.dateTo
      ? {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo.length === 10 ? `${query.dateTo}T23:59:59.999Z` : query.dateTo) } : {}),
        }
      : undefined;

    const counts: Record<WarehouseApprovalType, number> = {
      SPARE_PART: 0,
      RAW_MATERIAL: 0,
      FINISHED_GOOD: 0,
      PACKAGING_MATERIAL: 0,
      CONSUMABLE: 0,
      GENERAL: 0,
    };
    const rows: WarehouseApprovalRow[] = [];

    if (readableMaintenanceParts) {
      const sparePartWhere: any = {
        ...(status ? { status: this.sparePartStatus(status) } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.requesterId ? { requestedByUserId: filters.requesterId } : {}),
        maintenanceRequest: {
          deletedAt: null,
          machine: {
            companyId: ctx.companyId,
            OR: [{ branchId: ctx.branchId }, { branchId: null }],
          },
        },
      };
      if (search) {
        sparePartWhere.OR = [
          { maintenanceRequest: { requestNumber: { contains: search } } },
          { maintenanceRequest: { title: { contains: search } } },
          { sparePart: { name: { contains: search } } },
          { sparePart: { code: { contains: search } } },
        ];
      }
      if (dateFilter) sparePartWhere.createdAt = dateFilter;

      const [items, count] = await Promise.all([
        !type || type === 'SPARE_PART'
          ? (this.prisma as any).maintenanceRequestRequiredPart.findMany({
              where: sparePartWhere,
              take: takePerFamily,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                sparePart: { select: { id: true, code: true, name: true } },
                requestedBy: { select: { id: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                maintenanceRequest: {
                  select: {
                    id: true,
                    requestNumber: true,
                    title: true,
                    machine: { select: { id: true, code: true, name: true } },
                  },
                },
              },
            })
          : Promise.resolve([]),
        (this.prisma as any).maintenanceRequestRequiredPart.count({ where: sparePartWhere }),
      ]);
      counts.SPARE_PART += count;
      for (const part of items) {
        const request = part.maintenanceRequest;
        rows.push({
          key: `SPARE_PART:${part.id}`,
          type: 'SPARE_PART',
          authority: 'MAINTENANCE_REQUEST_PART',
          entityId: part.id,
          parentEntityId: request?.id ?? null,
          reference: `${request?.requestNumber ?? '-'} · ${part.sparePart?.code ?? '-'}`,
          title: part.sparePart?.name ?? request?.title ?? null,
          status: part.status,
          requestedAt: part.requestedAt ?? null,
          requestedById: part.requestedByUserId ?? null,
          requestedByName: part.requestedBy?.name ?? null,
          warehouse: part.warehouse ?? null,
          lineCount: 1,
          totalQuantity: Number(part.requestedQuantity ?? part.quantity ?? 0),
          createdAt: part.createdAt,
          documentDate: part.createdAt,
          sourceType: null,
        });
      }
    }

    // Standalone spare-part issues are a second native SPARE_PART authority.
    // They are tenant/branch scoped directly, unlike maintenance lines whose
    // scope comes from the owning machine.
    if (readableSparePartIssues) {
      const spareIssueWhere: any = {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        ...(status ? { status } : {}),
        ...(filters.warehouseId ? { issueWarehouseId: filters.warehouseId } : {}),
        ...(filters.requesterId ? { AND: [{ OR: [{ createdById: filters.requesterId }, { submittedById: filters.requesterId }] }] } : {}),
      };
      if (search) {
        spareIssueWhere.OR = [
          { issueNumber: { contains: search } },
          { purpose: { contains: search } },
          { notes: { contains: search } },
        ];
      }
      if (dateFilter) spareIssueWhere.issueDate = dateFilter;

      const [items, count] = await Promise.all([
        !type || type === 'SPARE_PART'
          ? (this.prisma as any).sparePartIssue.findMany({
              where: spareIssueWhere,
              take: takePerFamily,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                issueWarehouse: { select: { id: true, code: true, name: true } },
                lines: { select: { quantity: true } },
              },
            })
          : Promise.resolve([]),
        (this.prisma as any).sparePartIssue.count({ where: spareIssueWhere }),
      ]);
      counts.SPARE_PART += count;
      const requestedByIds = [...new Set(items.map((item: any) => (item.submittedById || item.createdById)).filter(Boolean))] as string[];
      const users = await this.loadUserNames(requestedByIds);
      for (const issue of items) {
        rows.push({
          key: `SPARE_PART_ISSUE:${issue.id}`,
          type: 'SPARE_PART',
          authority: 'SPARE_PART_ISSUE',
          entityId: issue.id,
          parentEntityId: issue.id,
          reference: issue.issueNumber,
          title: issue.purpose ?? null,
          status: issue.status,
          requestedAt: issue.submittedAt ?? null,
          requestedById: issue.submittedById ?? issue.createdById ?? null,
          requestedByName: users.get(issue.submittedById || issue.createdById) ?? null,
          warehouse: issue.issueWarehouse ?? null,
          lineCount: issue.lines.length,
          totalQuantity: issue.lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
          createdAt: issue.createdAt,
          documentDate: issue.issueDate,
          sourceType: issue.sourceType ?? null,
        });
      }
    }

    if (readableRawMaterials) {
      const rawWhere: any = { companyId: ctx.companyId, branchId: ctx.branchId, ...(status ? { status: status === 'REQUESTED' ? 'SUBMITTED' : status } : {}),
        ...(issues ? { documentType: 'ISSUE' } : {}),
        ...(filters.warehouseId ? { issueWarehouseId: filters.warehouseId } : {}),
        ...(filters.requesterId ? { AND: [{ OR: [{ createdById: filters.requesterId }, { submittedById: filters.requesterId }] }] } : {}),
      };
      if (search) {
        rawWhere.OR = [
          { documentNumber: { contains: search } },
          { notes: { contains: search } },
          { productionOrder: { orderNumber: { contains: search } } },
          { productionRun: { runNumber: { contains: search } } },
        ];
      }
      if (dateFilter) rawWhere.documentDate = dateFilter;

      const [items, count] = await Promise.all([
        !type || type === 'RAW_MATERIAL'
          ? (this.prisma as any).productionMaterialDocument.findMany({
              where: rawWhere,
              take: takePerFamily,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                productionOrder: { select: { id: true, orderNumber: true } },
                productionRun: { select: { id: true, runNumber: true } },
                issueWarehouse: { select: { id: true, code: true, name: true } },
                lines: { select: { quantity: true } },
              },
            })
          : Promise.resolve([]),
        (this.prisma as any).productionMaterialDocument.count({ where: rawWhere }),
      ]);
      counts.RAW_MATERIAL = count;
      const requestedByIds = [...new Set(items.map((item: any) => (item.submittedById || item.createdById)).filter(Boolean))] as string[];
      const users = await this.loadUserNames(requestedByIds);
      for (const doc of items) {
        rows.push({
          key: `RAW_MATERIAL:${doc.id}`,
          type: 'RAW_MATERIAL',
          authority: 'FLAT',
          entityId: doc.id,
          parentEntityId: doc.id,
          reference: doc.documentNumber,
          title: doc.productionOrder?.orderNumber
            ? `${doc.productionOrder.orderNumber} · ${doc.productionRun?.runNumber ?? '-'}`
            : null,
          status: doc.status,
          requestedAt: doc.submittedAt ?? null,
          requestedById: doc.submittedById ?? doc.createdById ?? null,
          requestedByName: users.get(doc.submittedById || doc.createdById) ?? null,
          warehouse: doc.issueWarehouse ?? null,
          lineCount: doc.lines.length,
          totalQuantity: doc.lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
          createdAt: doc.createdAt,
          documentDate: doc.documentDate,
          sourceType: doc.sourceType ?? null,
        });
      }
    }

    if (readableFinishedGoods) {
      const fgWhere: any = { companyId: ctx.companyId, branchId: ctx.branchId, ...(status ? { status: status === 'REQUESTED' ? 'SUBMITTED' : status } : {}),
        ...(filters.warehouseId ? { issueWarehouseId: filters.warehouseId } : {}),
        ...(filters.requesterId ? { AND: [{ OR: [{ createdById: filters.requesterId }, { submittedById: filters.requesterId }] }] } : {}),
      };
      if (search) {
        fgWhere.OR = [
          { issueNumber: { contains: search } },
          { purpose: { contains: search } },
          { notes: { contains: search } },
        ];
      }
      if (dateFilter) fgWhere.issueDate = dateFilter;

      const [items, count] = await Promise.all([
        !type || type === 'FINISHED_GOOD'
          ? (this.prisma as any).finishedGoodsIssue.findMany({
              where: fgWhere,
              take: takePerFamily,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: {
                issueWarehouse: { select: { id: true, code: true, name: true } },
                lines: { select: { quantity: true } },
              },
            })
          : Promise.resolve([]),
        (this.prisma as any).finishedGoodsIssue.count({ where: fgWhere }),
      ]);
      counts.FINISHED_GOOD = count;
      const requestedByIds = [...new Set(items.map((item: any) => (item.submittedById || item.createdById)).filter(Boolean))] as string[];
      const users = await this.loadUserNames(requestedByIds);
      for (const issue of items) {
        rows.push({
          key: `FINISHED_GOOD:${issue.id}`,
          type: 'FINISHED_GOOD',
          authority: 'FLAT',
          entityId: issue.id,
          parentEntityId: issue.id,
          reference: issue.issueNumber,
          title: issue.purpose ?? null,
          status: issue.status,
          requestedAt: issue.submittedAt ?? null,
          requestedById: issue.submittedById ?? issue.createdById ?? null,
          requestedByName: users.get(issue.submittedById || issue.createdById) ?? null,
          warehouse: issue.issueWarehouse ?? null,
          lineCount: issue.lines.length,
          totalQuantity: issue.lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
          createdAt: issue.createdAt,
          documentDate: issue.issueDate,
          sourceType: issue.sourceType ?? null,
        });
      }
    }

    // PACKAGING_MATERIAL / CONSUMABLE / GENERAL are all persisted by the one
    // canonical general OUT authority, separated only by its validated issueType.
    if (readableGeneralIssues) {
      const generalTypes: IssueType[] = ['PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL'];
      for (const generalType of generalTypes) {
        const generalWhere: any = {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          issueType: generalType,
          ...(status ? { status: status === 'REQUESTED' ? 'SUBMITTED' : status } : {}),
          ...(filters.warehouseId ? { issueWarehouseId: filters.warehouseId } : {}),
          ...(filters.requesterId ? { AND: [{ OR: [{ createdById: filters.requesterId }, { submittedById: filters.requesterId }] }] } : {}),
        };
        if (search) {
          generalWhere.OR = [
            { issueNumber: { contains: search } },
            { purpose: { contains: search } },
            { notes: { contains: search } },
          ];
        }
        if (dateFilter) generalWhere.issueDate = dateFilter;

        const [items, count] = await Promise.all([
          !type || type === generalType
            ? (this.prisma as any).generalInventoryIssue.findMany({
                where: generalWhere,
                take: takePerFamily,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                include: {
                  issueWarehouse: { select: { id: true, code: true, name: true } },
                  lines: { select: { quantity: true } },
                },
              })
            : Promise.resolve([]),
          (this.prisma as any).generalInventoryIssue.count({ where: generalWhere }),
        ]);
        counts[generalType] = count;
        const requestedByIds = [...new Set(items.map((item: any) => (item.submittedById || item.createdById)).filter(Boolean))] as string[];
        const users = await this.loadUserNames(requestedByIds);
        for (const issue of items) {
          rows.push({
            key: `${generalType}:${issue.id}`,
            type: generalType,
            authority: 'GENERAL_INVENTORY_ISSUE',
            entityId: issue.id,
            parentEntityId: issue.id,
            reference: issue.issueNumber,
            title: issue.purpose ?? null,
            status: issue.status,
            requestedAt: issue.submittedAt ?? null,
            requestedById: issue.submittedById ?? issue.createdById ?? null,
            requestedByName: users.get(issue.submittedById || issue.createdById) ?? null,
            warehouse: issue.issueWarehouse ?? null,
            lineCount: issue.lines.length,
            totalQuantity: issue.lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
            createdAt: issue.createdAt,
            documentDate: issue.issueDate,
            sourceType: issue.sourceType ?? null,
          });
        }
      }
    }

    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.key.localeCompare(a.key));
    // Counts always describe all readable families so the inbox cards stay
    // stable while a type filter narrows the rows. Pagination totals must match
    // the rows actually being filtered.
    const total = type
      ? counts[type]
      : counts.SPARE_PART + counts.RAW_MATERIAL + counts.FINISHED_GOOD + counts.PACKAGING_MATERIAL + counts.CONSUMABLE + counts.GENERAL;
    const paged = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

    return {
      data: paged,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        counts,
      },
      permissions: REPORTABLE_PERMISSION_KEYS.filter((key) => this.can(grant, key)),
    };
  }

  private async loadUserNames(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
