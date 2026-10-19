import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductsService } from './products.service';
import { ProductionProductDefinitionsService } from '../production-master-data/production-product-definitions.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UnifiedProductionConfigDto } from './dto/unified-production-config.dto';

/**
 * Single canonical Product aggregate.
 *
 * One create / one edit / one save for a Product and its production
 * configuration. The Product is the sole identity authority; the production
 * configuration is written by the production definitions service inside the
 * same database transaction so an operational write is never left half-applied.
 *
 * The nested production payload is an optional extension of the existing
 * `POST /products` and `PATCH /products/:id` surface, so the endpoint contract
 * stays backward compatible for callers that only send product fields.
 */
@Injectable()
export class ProductAggregateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly definitions: ProductionProductDefinitionsService,
    private readonly permissions: PermissionCheckService,
  ) {}

  private productionPayload(dto: { production?: UnifiedProductionConfigDto }): UnifiedProductionConfigDto | undefined {
    return dto.production;
  }

  async create(dto: CreateProductDto, userId: string, ctx: ActiveOperationalContext) {
    const cfg = this.productionPayload(dto);
    const enableProduction = !!cfg && cfg.enabled !== false;

    // Secondary domain permission: a caller who can create inventory products may
    // not necessarily configure production. Enforced server-side on the same call.
    if (cfg) await this.permissions.assertAll(userId, ['production-product:create']);

    const productCode = dto.code?.trim() || await this.products.generateProductCode();
    const definitionCode = enableProduction ? await this.definitions.generateDefinitionCode() : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await this.products.createInTx(tx, dto, userId, productCode);

        if (cfg) {
          await this.definitions.applyForProductInTx(
            tx,
            {
              productId: product.id,
              productName: product.name,
              productStatus: product.status,
              enabled: enableProduction,
              code: definitionCode,
              notes: cfg.notes,
              defaultUnitId: cfg.defaultUnitId,
              defaultLineId: cfg.defaultLineId,
              defaultWarehouseId: cfg.defaultWarehouseId,
              defaultCostCenterId: cfg.defaultCostCenterId,
            },
            userId,
            ctx,
          );
        }

        return this.products.findOneInTx(tx, product.id, ctx);
      });
    } catch (error) {
      // Domain validation and unique-constraint errors from the atomic product
      // write must surface as stable 4xx contracts, never a raw 500.
      throw this.products.rethrowUomError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto, userId: string, ctx: ActiveOperationalContext) {
    const cfg = this.productionPayload(dto);
    if (cfg) await this.permissions.assertAll(userId, ['production-product:update']);

    const existing = await this.products.findOne(id);
    const resolvedName = dto.name !== undefined ? dto.name : existing.name;
    const resolvedStatus = existing.status;
    const enableProduction = !!cfg && cfg.enabled !== false;

    // Generate the production reference only when a new definition must be created,
    // so editing an existing configuration never consumes a numbering sequence.
    const needsNewDefinition = enableProduction && !(await this.definitions.hasDefinitionFor(id, ctx));
    const definitionCode = needsNewDefinition ? await this.definitions.generateDefinitionCode() : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.products.updateInTx(tx, id, dto, existing, userId);

        if (cfg) {
          await this.definitions.applyForProductInTx(
            tx,
            {
              productId: id,
              productName: resolvedName,
              productStatus: resolvedStatus,
              enabled: enableProduction,
              code: definitionCode,
              notes: cfg.notes,
              defaultUnitId: cfg.defaultUnitId,
              defaultLineId: cfg.defaultLineId,
              defaultWarehouseId: cfg.defaultWarehouseId,
              defaultCostCenterId: cfg.defaultCostCenterId,
            },
            userId,
            ctx,
          );
        }

        return this.products.findOneInTx(tx, id, ctx);
      });
    } catch (error) {
      throw this.products.rethrowUomError(error);
    }
  }
}
