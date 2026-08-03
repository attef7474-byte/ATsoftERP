import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { Prisma } from '@prisma/client';
import { CreateProductionProductDefinitionDto } from './dto/create-production-product-definition.dto';
import { UpdateProductionProductDefinitionDto } from './dto/update-production-product-definition.dto';
import { ProductionProductDefinitionQueryDto } from './dto/production-product-definition-query.dto';
import {
  CreateSpecificationDto,
  CreateVersionDto,
  CreatePackagingDto,
  CreateEligibilityDto,
} from './dto/create-production-child.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionProductDefinitionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ messageKey: 'production.definitionNotFound', message: 'Production product definition not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const definition = await this.prisma.productionProductDefinition.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!definition) throw this.notFound();
    return definition;
  }

  private async validateProduct(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    if (product.status === 'INACTIVE') {
      throw this.validationError('productId', 'validation.invalidReference', 'Product is inactive');
    }
    return product;
  }

  private async validateUnit(unitId: string | undefined, field: string, ctx: ActiveOperationalContext) {
    if (!unitId) return;
    const unit = await this.prisma.productionUnit.findFirst({
      where: { id: unitId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!unit) throw this.validationError(field, 'validation.invalidReference', 'Production unit not found in tenant context');
  }

  private async validateLine(lineId: string | undefined, field: string, ctx: ActiveOperationalContext) {
    if (!lineId) return;
    const line = await this.prisma.productionLine.findFirst({
      where: { id: lineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!line) throw this.validationError(field, 'validation.invalidReference', 'Production line not found in tenant context');
  }

  private async validateWarehouse(warehouseId: string | undefined, field: string, ctx: ActiveOperationalContext) {
    if (!warehouseId) return;
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw this.validationError(field, 'validation.invalidReference', 'Warehouse not found');
    if (warehouse.companyId !== ctx.companyId) {
      throw this.validationError(field, 'validation.invalidReference', 'Warehouse belongs to another company');
    }
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.validationError(field, 'validation.invalidReference', 'Warehouse belongs to another branch');
    }
  }

  private async validateCostCenter(costCenterId: string | undefined, field: string, ctx: ActiveOperationalContext) {
    if (!costCenterId) return;
    const costCenter = await this.prisma.costCenter.findUnique({ where: { id: costCenterId } });
    if (!costCenter) throw this.validationError(field, 'validation.invalidReference', 'Cost center not found');
    if (costCenter.companyId && costCenter.companyId !== ctx.companyId) {
      throw this.validationError(field, 'validation.invalidReference', 'Cost center belongs to another company');
    }
    if (costCenter.branchId && costCenter.branchId !== ctx.branchId) {
      throw this.validationError(field, 'validation.invalidReference', 'Cost center belongs to another branch');
    }
  }

  async create(dto: CreateProductionProductDefinitionDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const product = await this.validateProduct(dto.productId);
    await this.validateUnit(dto.defaultUnitId, 'defaultUnitId', ctx);
    await this.validateLine(dto.defaultLineId, 'defaultLineId', ctx);
    await this.validateWarehouse(dto.defaultWarehouseId, 'defaultWarehouseId', ctx);
    await this.validateCostCenter(dto.defaultCostCenterId, 'defaultCostCenterId', ctx);

    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_PRODUCT'));
    const duplicateCode = await this.prisma.productionProductDefinition.findFirst({ where: { code, deletedAt: null } });
    if (duplicateCode) throw this.validationError('code', 'production.codeExists', 'Production product code already exists');

    const definition = await this.prisma.productionProductDefinition.create({
      data: {
        code,
        name: dto.name?.trim() || product.name,
        description: dto.description ?? null,
        productId: dto.productId,
        defaultUnitId: dto.defaultUnitId ?? null,
        defaultLineId: dto.defaultLineId ?? null,
        defaultWarehouseId: dto.defaultWarehouseId ?? null,
        defaultCostCenterId: dto.defaultCostCenterId ?? null,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        createdById: userId,
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        defaultUnit: { select: { id: true, code: true, name: true } },
        defaultLine: { select: { id: true, code: true, name: true } },
        defaultWarehouse: { select: { id: true, code: true, name: true } },
        defaultCostCenter: { select: { id: true, code: true, name: true } },
      },
    });
    await this.audit.log(userId, 'CREATE', 'ProductionProductDefinition', definition.id, {
      code: definition.code,
      productId: definition.productId,
    });
    return definition;
  }

  async findAll(query: ProductionProductDefinitionQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { product: { is: { name: { contains: query.search } } } },
        { product: { is: { code: { contains: query.search } } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    if (query.defaultLineId) where.defaultLineId = query.defaultLineId;

    const [data, total] = await Promise.all([
      this.prisma.productionProductDefinition.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          defaultUnit: { select: { id: true, code: true, name: true } },
          defaultLine: { select: { id: true, code: true, name: true } },
          defaultWarehouse: { select: { id: true, code: true, name: true } },
          defaultCostCenter: { select: { id: true, code: true, name: true } },
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.productionProductDefinition.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    return this.prisma.productionProductDefinition.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true, description: true } },
        defaultUnit: { select: { id: true, code: true, name: true } },
        defaultLine: { select: { id: true, code: true, name: true } },
        defaultWarehouse: { select: { id: true, code: true, name: true } },
        defaultCostCenter: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        specifications: { where: { status: 'ACTIVE' }, orderBy: { sortOrder: 'asc' } },
        versions: { where: { status: 'ACTIVE' }, orderBy: { versionNumber: 'desc' } },
        packagings: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
        eligibilities: {
          where: { status: 'ACTIVE' },
          include: {
            machine: { select: { id: true, code: true, name: true } },
            productionLine: { select: { id: true, code: true, name: true } },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });
  }

  async update(id: string, dto: UpdateProductionProductDefinitionDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    if (dto.productId) await this.validateProduct(dto.productId);
    await this.validateUnit(dto.defaultUnitId, 'defaultUnitId', ctx);
    await this.validateLine(dto.defaultLineId, 'defaultLineId', ctx);
    await this.validateWarehouse(dto.defaultWarehouseId, 'defaultWarehouseId', ctx);
    await this.validateCostCenter(dto.defaultCostCenterId, 'defaultCostCenterId', ctx);

    const definition = await this.prisma.productionProductDefinition.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        productId: dto.productId !== undefined ? dto.productId : undefined,
        defaultUnitId: dto.defaultUnitId !== undefined ? (dto.defaultUnitId || null) : undefined,
        defaultLineId: dto.defaultLineId !== undefined ? (dto.defaultLineId || null) : undefined,
        defaultWarehouseId: dto.defaultWarehouseId !== undefined ? (dto.defaultWarehouseId || null) : undefined,
        defaultCostCenterId: dto.defaultCostCenterId !== undefined ? (dto.defaultCostCenterId || null) : undefined,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionProductDefinition', id, { code: definition.code });
    return definition;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.prisma.$transaction(async (tx) => {
      await tx.productionSpecification.updateMany({ where: { productionProductId: id }, data: { status: 'INACTIVE' } });
      await tx.productionVersion.updateMany({ where: { productionProductId: id }, data: { status: 'INACTIVE' } });
      await tx.productionPackaging.updateMany({ where: { productionProductId: id }, data: { status: 'INACTIVE' } });
      await tx.productionEligibility.updateMany({ where: { productionProductId: id }, data: { status: 'INACTIVE' } });
      await tx.productionProductDefinition.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    await this.audit.log(userId, 'DELETE', 'ProductionProductDefinition', id);
    return { message: 'Production product definition deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const definition = await this.prisma.productionProductDefinition.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionProductDefinition', id);
    return definition;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const definition = await this.prisma.productionProductDefinition.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionProductDefinition', id);
    return definition;
  }

  private async findOwnedChild(parentId: string, ctx: ActiveOperationalContext) {
    const definition = await this.prisma.productionProductDefinition.findFirst({
      where: { id: parentId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!definition) throw this.notFound();
    return definition;
  }

  async addSpecification(parentId: string, dto: CreateSpecificationDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    if (dto.unitId) await this.validateUnit(dto.unitId, 'unitId', ctx);
    const spec = await this.prisma.productionSpecification.create({
      data: {
        productionProductId: parentId,
        attributeName: dto.attributeName,
        attributeValue: dto.attributeValue,
        dataType: dto.dataType ?? 'TEXT',
        unitId: dto.unitId ?? null,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log(userId, 'CREATE', 'ProductionSpecification', spec.id, { productionProductId: parentId });
    return spec;
  }

  async updateSpecification(parentId: string, childId: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionSpecification.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.specificationNotFound', message: 'Specification not found' });
    if (dto.unitId !== undefined && dto.unitId) await this.validateUnit(dto.unitId, 'unitId', ctx);
    const spec = await this.prisma.productionSpecification.update({
      where: { id: childId },
      data: {
        attributeName: dto.attributeName ?? existing.attributeName,
        attributeValue: dto.attributeValue ?? existing.attributeValue,
        dataType: dto.dataType ?? existing.dataType,
        unitId: dto.unitId !== undefined ? (dto.unitId || null) : existing.unitId,
        isRequired: dto.isRequired !== undefined ? dto.isRequired : existing.isRequired,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionSpecification', childId, { productionProductId: parentId });
    return spec;
  }

  async removeSpecification(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionSpecification.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.specificationNotFound', message: 'Specification not found' });
    await this.prisma.productionSpecification.update({ where: { id: childId }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'ProductionSpecification', childId, { productionProductId: parentId });
    return { message: 'Specification deleted successfully' };
  }

  async addVersion(parentId: string, dto: CreateVersionDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    let versionNumber = dto.versionNumber;
    if (versionNumber === undefined) {
      const last = await this.prisma.productionVersion.findFirst({
        where: { productionProductId: parentId },
        orderBy: { versionNumber: 'desc' },
      });
      versionNumber = (last?.versionNumber ?? 0) + 1;
    }
    const duplicate = await this.prisma.productionVersion.findFirst({
      where: { productionProductId: parentId, versionNumber },
    });
    if (duplicate) throw this.validationError('versionNumber', 'production.versionExists', 'Version number already exists');

    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.productionVersion.updateMany({ where: { productionProductId: parentId }, data: { isCurrent: false } });
      }
      return tx.productionVersion.create({
        data: {
          productionProductId: parentId,
          versionNumber,
          versionLabel: dto.versionLabel,
          description: dto.description ?? null,
          isCurrent: dto.isCurrent ?? false,
          createdById: userId,
        },
      });
    });
    await this.audit.log(userId, 'CREATE', 'ProductionVersion', version.id, { productionProductId: parentId, versionNumber });
    return version;
  }

  async updateVersion(parentId: string, childId: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionVersion.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.versionNotFound', message: 'Version not found' });
    if (dto.versionNumber !== undefined && dto.versionNumber !== existing.versionNumber) {
      const duplicate = await this.prisma.productionVersion.findFirst({
        where: { productionProductId: parentId, versionNumber: dto.versionNumber },
      });
      if (duplicate) throw this.validationError('versionNumber', 'production.versionExists', 'Version number already exists');
    }
    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.productionVersion.updateMany({ where: { productionProductId: parentId }, data: { isCurrent: false } });
      }
      return tx.productionVersion.update({
        where: { id: childId },
        data: {
          versionNumber: dto.versionNumber ?? existing.versionNumber,
          versionLabel: dto.versionLabel ?? existing.versionLabel,
          description: dto.description !== undefined ? dto.description : existing.description,
          isCurrent: dto.isCurrent !== undefined ? dto.isCurrent : existing.isCurrent,
        },
      });
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionVersion', childId, { productionProductId: parentId });
    return version;
  }

  async setCurrentVersion(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionVersion.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.versionNotFound', message: 'Version not found' });
    await this.prisma.$transaction(async (tx) => {
      await tx.productionVersion.updateMany({ where: { productionProductId: parentId }, data: { isCurrent: false } });
      await tx.productionVersion.update({ where: { id: childId }, data: { isCurrent: true } });
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionVersion', childId, { productionProductId: parentId, setCurrent: true });
    return { message: 'Version set as current' };
  }

  async removeVersion(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionVersion.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.versionNotFound', message: 'Version not found' });
    if (existing.isCurrent) {
      throw new ConflictException({ messageKey: 'production.currentVersionLocked', message: 'Current version cannot be deleted' });
    }
    await this.prisma.productionVersion.update({ where: { id: childId }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'ProductionVersion', childId, { productionProductId: parentId });
    return { message: 'Version deleted successfully' };
  }

  async addPackaging(parentId: string, dto: CreatePackagingDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    if (dto.unitId) await this.validateUnit(dto.unitId, 'unitId', ctx);
    const packQuantity = new Prisma.Decimal(dto.packQuantity);
    if (!packQuantity.greaterThan(0)) throw this.validationError('packQuantity', 'validation.positiveRequired', 'Pack quantity must be greater than 0');
    const packaging = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productionPackaging.updateMany({ where: { productionProductId: parentId }, data: { isDefault: false } });
      }
      return (tx.productionPackaging as any).create({
        data: {
          productionProductId: parentId,
          packagingType: dto.packagingType,
          packQuantity,
          unitId: dto.unitId ?? null,
          grossWeight: dto.grossWeight === undefined ? null : new Prisma.Decimal(dto.grossWeight),
          netWeight: dto.netWeight === undefined ? null : new Prisma.Decimal(dto.netWeight),
          isDefault: dto.isDefault ?? false,
        },
      });
    });
    await this.audit.log(userId, 'CREATE', 'ProductionPackaging', packaging.id, { productionProductId: parentId });
    return packaging;
  }

  async updatePackaging(parentId: string, childId: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionPackaging.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.packagingNotFound', message: 'Packaging not found' });
    if (dto.unitId !== undefined && dto.unitId) await this.validateUnit(dto.unitId, 'unitId', ctx);
    const packaging = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productionPackaging.updateMany({ where: { productionProductId: parentId }, data: { isDefault: false } });
      }
      return (tx.productionPackaging as any).update({
        where: { id: childId },
        data: {
          packagingType: dto.packagingType ?? existing.packagingType,
          packQuantity: dto.packQuantity === undefined ? existing.packQuantity : new Prisma.Decimal(dto.packQuantity),
          unitId: dto.unitId !== undefined ? (dto.unitId || null) : existing.unitId,
          grossWeight: dto.grossWeight !== undefined ? new Prisma.Decimal(dto.grossWeight) : existing.grossWeight,
          netWeight: dto.netWeight !== undefined ? new Prisma.Decimal(dto.netWeight) : existing.netWeight,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
        },
      });
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionPackaging', childId, { productionProductId: parentId });
    return packaging;
  }

  async setDefaultPackaging(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionPackaging.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.packagingNotFound', message: 'Packaging not found' });
    await this.prisma.$transaction(async (tx) => {
      await tx.productionPackaging.updateMany({ where: { productionProductId: parentId }, data: { isDefault: false } });
      await tx.productionPackaging.update({ where: { id: childId }, data: { isDefault: true } });
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionPackaging', childId, { productionProductId: parentId, setDefault: true });
    return { message: 'Packaging set as default' };
  }

  async removePackaging(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionPackaging.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.packagingNotFound', message: 'Packaging not found' });
    await this.prisma.productionPackaging.update({ where: { id: childId }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'ProductionPackaging', childId, { productionProductId: parentId });
    return { message: 'Packaging deleted successfully' };
  }

  async addEligibility(parentId: string, dto: CreateEligibilityDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const resourceType = dto.resourceType.toUpperCase();
    if (!['MACHINE', 'LINE'].includes(resourceType)) {
      throw this.validationError('resourceType', 'production.invalidResourceType', 'resourceType must be MACHINE or LINE');
    }
    let machineId: string | null = null;
    let productionLineId: string | null = null;
    if (resourceType === 'MACHINE') {
      if (!dto.machineId || dto.productionLineId) {
        throw this.validationError('machineId', 'production.resourceConflict', 'MACHINE eligibility requires machineId and no productionLineId');
      }
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      if (machine.companyId && machine.companyId !== ctx.companyId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another company');
      }
      if (machine.branchId && machine.branchId !== ctx.branchId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another branch');
      }
      machineId = dto.machineId;
    } else {
      if (!dto.productionLineId || dto.machineId) {
        throw this.validationError('productionLineId', 'production.resourceConflict', 'LINE eligibility requires productionLineId and no machineId');
      }
      const line = await this.prisma.productionLine.findFirst({
        where: { id: dto.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!line) throw this.validationError('productionLineId', 'validation.invalidReference', 'Production line not found in tenant context');
      productionLineId = dto.productionLineId;
    }

    const duplicate = await this.prisma.productionEligibility.findFirst({
      where: {
        productionProductId: parentId,
        resourceType,
        machineId,
        productionLineId,
      },
    });
    if (duplicate) throw this.validationError('resourceType', 'production.eligibilityExists', 'Eligibility for this resource already exists');

    const eligibility = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productionEligibility.updateMany({
          where: { productionProductId: parentId, resourceType },
          data: { isDefault: false },
        });
      }
      return tx.productionEligibility.create({
        data: {
          productionProductId: parentId,
          resourceType,
          machineId,
          productionLineId,
          priority: dto.priority ?? 0,
          isDefault: dto.isDefault ?? false,
          notes: dto.notes ?? null,
        },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
        },
      });
    });
    await this.audit.log(userId, 'CREATE', 'ProductionEligibility', eligibility.id, { productionProductId: parentId, resourceType });
    return eligibility;
  }

  async updateEligibility(parentId: string, childId: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionEligibility.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.eligibilityNotFound', message: 'Eligibility not found' });
    const resourceType = (dto.resourceType ?? existing.resourceType).toUpperCase();
    if (!['MACHINE', 'LINE'].includes(resourceType)) {
      throw this.validationError('resourceType', 'production.invalidResourceType', 'resourceType must be MACHINE or LINE');
    }
    let machineId = existing.machineId;
    let productionLineId = existing.productionLineId;
    if (resourceType === 'MACHINE') {
      machineId = dto.machineId ?? existing.machineId;
      productionLineId = null;
      if (!machineId) throw this.validationError('machineId', 'production.resourceConflict', 'MACHINE eligibility requires machineId');
      const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      if (machine.companyId && machine.companyId !== ctx.companyId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another company');
      }
      if (machine.branchId && machine.branchId !== ctx.branchId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another branch');
      }
    } else {
      productionLineId = dto.productionLineId ?? existing.productionLineId;
      machineId = null;
      if (!productionLineId) throw this.validationError('productionLineId', 'production.resourceConflict', 'LINE eligibility requires productionLineId');
      const line = await this.prisma.productionLine.findFirst({
        where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!line) throw this.validationError('productionLineId', 'validation.invalidReference', 'Production line not found in tenant context');
    }

    const duplicate = await this.prisma.productionEligibility.findFirst({
      where: {
        productionProductId: parentId,
        resourceType,
        machineId,
        productionLineId,
        NOT: { id: childId },
      },
    });
    if (duplicate) throw this.validationError('resourceType', 'production.eligibilityExists', 'Eligibility for this resource already exists');

    const eligibility = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productionEligibility.updateMany({
          where: { productionProductId: parentId, resourceType },
          data: { isDefault: false },
        });
      }
      return tx.productionEligibility.update({
        where: { id: childId },
        data: {
          resourceType,
          machineId,
          productionLineId,
          priority: dto.priority ?? existing.priority,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
        },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
        },
      });
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionEligibility', childId, { productionProductId: parentId });
    return eligibility;
  }

  async removeEligibility(parentId: string, childId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedChild(parentId, ctx);
    const existing = await this.prisma.productionEligibility.findFirst({
      where: { id: childId, productionProductId: parentId },
    });
    if (!existing) throw new NotFoundException({ messageKey: 'production.eligibilityNotFound', message: 'Eligibility not found' });
    await this.prisma.productionEligibility.update({ where: { id: childId }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'ProductionEligibility', childId, { productionProductId: parentId });
    return { message: 'Eligibility deleted successfully' };
  }
}
