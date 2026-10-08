import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AllowedContextResolver } from '../../../../common/operational-context/allowed-context.resolver';
import { CreateOperationTypeDto } from './dto/create-operation-type.dto';
import { UpdateOperationTypeDto } from './dto/update-operation-type.dto';

@Injectable()
export class OperationTypesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
    private allowedContextResolver: AllowedContextResolver,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateOperationTypeDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('OPERATION_TYPE');
    const existing = await this.prisma.operationType.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Operation type code already exists');

    const item = await this.prisma.operationType.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'OperationType', item.id, { message: `Created operation type: ${item.code}` });
    return item;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.operationType.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.operationType.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.operationType.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Operation type not found');
    return item;
  }

  async update(id: string, dto: UpdateOperationTypeDto, userId: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code !== existing.code) {
      throw new BadRequestException('Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;
    const item = await this.prisma.operationType.update({ where: { id }, data: updateDto });
    await this.auditService.log(userId, 'UPDATE', 'OperationType', id, { message: `Updated operation type: ${item.code}` });
    return item;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const machineCount = await this.prisma.machine.count({ where: { operationTypeId: id, deletedAt: null } });
    if (machineCount > 0) throw new ConflictException('Cannot delete operation type with linked machines');
    const plCount = await this.prisma.productionLine.count({ where: { operationTypeId: id, deletedAt: null } });
    if (plCount > 0) throw new ConflictException('Cannot delete operation type with linked production lines');
    const reqCount = await this.prisma.maintenanceRequest.count({ where: { operationTypeId: id, deletedAt: null } });
    if (reqCount > 0) throw new ConflictException('Cannot delete operation type with linked maintenance requests');
    await this.prisma.operationType.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'OperationType', id, { message: `Deleted operation type: ${id}` });
    return { message: 'Operation type deleted successfully' };
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.operationType.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'OperationType', id);
    return item;
  }

  async deactivate(id: string, userId: string) {
    const item = await this.findOne(id);
    const updated = await this.prisma.operationType.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'OperationType', id);
    return updated;
  }

  /**
   * Restore a soft-deleted OperationType.
   *
   * `activate` is NOT a restore: it only flips `status` and deliberately leaves
   * `deletedAt` set, so an activated-but-deleted record stays invisible to every
   * read path (`findAll` filters `deletedAt: null`) and to reference validation
   * such as ProductionLinesService.validateHierarchy. The two operations are
   * therefore distinct lifecycle actions and are audited separately.
   *
   * OperationType is GLOBAL reference/master data with no company or branch
   * column, so restoring one row changes what every tenant can see and select.
   * That is why this path is privileged in two independent layers:
   *
   * - `operation-type:update` is enforced by the controller guards. The shared
   *   PermissionsGuard grants SUPER_ADMIN a documented bypass, which is why that
   *   layer alone is not sufficient here.
   * - SUPER_ADMIN system-administration authority is re-resolved from the
   *   database on every call via AllowedContextResolver, the same narrow check
   *   used by the first-branch bootstrap path. No role, company or branch is
   *   ever read from the request.
   *
   * The restore targets the SAME row: id, code, name, description, createdAt and
   * the existing status are all preserved. Only `deletedAt` is cleared. No code
   * is generated and no replacement row is created.
   */
  async restore(id: string, userId: string) {
    await this.assertSystemAdministration(userId);

    // Deliberately NOT filtered by deletedAt: the record we are here to revive
    // is exactly the one every read path hides.
    const existing = await this.prisma.operationType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        messageKey: 'maintenance.operationTypeNotFound',
        message: 'Operation type not found',
      });
    }

    if (!existing.deletedAt) {
      throw this.validationError(
        'id',
        'operationType.notDeleted',
        'Operation type is not deleted',
      );
    }

    const restored = await this.prisma.operationType.update({
      where: { id },
      // `status` is intentionally untouched: restoration is not activation and
      // must not silently re-enable a record an administrator disabled.
      data: { deletedAt: null },
    });

    await this.auditService.log(userId, 'RESTORE', 'OperationType', restored.id, {
      message: `Restored operation type: ${restored.code}`,
      code: restored.code,
      previousDeletedAt: existing.deletedAt.toISOString(),
    });

    return restored;
  }

  private async assertSystemAdministration(userId: string): Promise<void> {
    const authorization = await this.allowedContextResolver.getAuthorization(userId);
    if (!authorization.isSuperAdmin) {
      throw new ForbiddenException({
        messageKey: 'organization.systemAdministrationRequired',
        message: 'This action requires system administration authority',
      });
    }
  }
}
