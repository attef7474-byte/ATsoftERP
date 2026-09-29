import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../audit/audit.service';
import { AllowedContextResolver } from '../../../common/operational-context/allowed-context.resolver';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BootstrapFirstBranchDto } from './dto/bootstrap-first-branch.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private auditService: AuditService,
    private allowedContextResolver: AllowedContextResolver,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private bootstrapError(
    field: string,
    messageKey: string,
    message: string,
    status: 'badRequest' | 'conflict',
  ) {
    const body = {
      messageKey,
      message,
      errors: [{ field, code: messageKey, message }],
    };
    return status === 'conflict'
      ? new ConflictException(body)
      : new BadRequestException(body);
  }

  /**
   * First-branch bootstrap for a company that cannot have an active operational
   * context yet.
   *
   * A company with zero branches is unreachable through the normal operational
   * context flow: establishing a context requires an existing ACTIVE branch, and
   * creating a branch requires a context. This path closes that bootstrap
   * deadlock without weakening the context-bound path, and it is deliberately
   * narrower than it looks:
   *
   * - JWT authenticated and `branches:create` permission is enforced by the
   *   controller guards.
   * - SUPER_ADMIN system-administration authority is resolved from the database
   *   and is mandatory, because the submitted companyId is trusted only here.
   * - The target company must exist, be ACTIVE and not soft-deleted.
   * - The target company must currently have zero non-deleted branches.
   * - The created branch belongs to the submitted company, never to the caller's
   *   active-context company.
   * - No user scope, role, permission or other tenant is mutated.
   */
  async bootstrapFirstBranch(dto: BootstrapFirstBranchDto, userId: string) {
    await this.assertSystemAdministration(userId);

    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!company) {
      throw this.bootstrapError(
        'companyId',
        'organization.companyNotFound',
        'Company not found',
        'badRequest',
      );
    }
    if (company.status !== 'ACTIVE') {
      throw this.bootstrapError(
        'companyId',
        'organization.bootstrapCompanyNotActive',
        'Company is not active',
        'badRequest',
      );
    }

    await this.assertCompanyHasNoBranches(company.id);

    const requestedCode = dto.code?.trim();
    if (requestedCode) {
      const duplicate = await this.prisma.branch.findFirst({
        where: { companyId: company.id, code: requestedCode, deletedAt: null },
      });
      if (duplicate) {
        throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Re-assert the zero-branch precondition on the same client that performs
      // the insert so a concurrent bootstrap cannot create a second branch.
      const currentCount = await tx.branch.count({
        where: { companyId: company.id, deletedAt: null },
      });
      if (currentCount > 0) {
        throw this.bootstrapError(
          'companyId',
          'organization.bootstrapBranchAlreadyExists',
          'Company already has a branch',
          'conflict',
        );
      }

      const code =
        requestedCode ||
        (await this.numberingService.generateNumberAtomicWithClient('BRANCH', tx));

      const created = await tx.branch.create({
        data: {
          companyId: company.id,
          code,
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
        },
      });

      await this.auditService.logWithClient(tx, {
        userId,
        action: 'BRANCH_FIRST_BOOTSTRAP',
        entity: 'Branch',
        entityId: created.id,
        details: {
          reason: 'COMPANY_FIRST_BRANCH_BOOTSTRAP',
          companyId: company.id,
          companyCode: company.code,
          companyName: company.name,
          branchId: created.id,
          branchCode: created.code,
          branchName: created.name,
        },
      });

      return created;
    });
  }

  private async assertSystemAdministration(userId: string): Promise<void> {
    const authorization = await this.allowedContextResolver.getAuthorization(userId);
    if (!authorization.isSuperAdmin) {
      throw new ForbiddenException({
        messageKey: 'organization.systemAdministrationRequired',
        message: 'System administration authority is required',
      });
    }
  }

  private async assertCompanyHasNoBranches(companyId: string): Promise<void> {
    const count = await this.prisma.branch.count({
      where: { companyId, deletedAt: null },
    });
    if (count > 0) {
      throw this.bootstrapError(
        'companyId',
        'organization.bootstrapBranchAlreadyExists',
        'Company already has a branch',
        'conflict',
      );
    }
  }

  async create(dto: CreateBranchDto, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('BRANCH'));

    const existing = await this.prisma.branch.findFirst({
      where: { companyId: ctx.companyId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');

    const { companyId: _companyId, ...rest } = dto;
    return this.prisma.branch.create({ data: { ...rest, companyId: ctx.companyId, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.search) where.name = { contains: query.search };

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    if (!branch) {
      throw new NotFoundException({ messageKey: 'organization.branchNotFound', message: 'Branch not found' });
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, ctx: ActiveOperationalContext) {
    const branch = await this.findOne(id, ctx);

    const code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.branch.findFirst({
        where: { companyId: ctx.companyId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');
      dto = { ...dto, code };
    }
    const { companyId: _companyId, ...data } = dto;
    return this.prisma.branch.update({ where: { id: branch.id }, data });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Branch deleted successfully' };
  }
}
