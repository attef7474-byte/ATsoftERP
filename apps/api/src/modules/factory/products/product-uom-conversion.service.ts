import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { computeBaseQuantity } from './product-uom.domain';

export interface ConversionInput {
  quantity: number | string;
  productUomId?: string | null;
  unitId?: string | null;
}

export interface ConversionResult {
  productUomId: string | null;
  enteredUnitId: string | null;
  conversionToBase: Prisma.Decimal;
  enteredQuantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
}

/**
 * Canonical server-side conversion authority for Product multi-UOM inventory.
 *
 * Every inventory flow that accepts a transaction quantity in a packaging unit
 * MUST route through this service so the authoritative base-unit quantity is
 * computed in exactly one place. The base unit always resolves to factor 1.
 */
@Injectable()
export class ProductUomConversionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolves the conversion-to-base factor (as Prisma.Decimal) for a product
   * line expressed either by productUomId (preferred) or by unitId. Falls back
   * to the product base unit (factor 1) when neither is supplied.
   */
  async resolveFactor(
    client: any,
    productId: string,
    input: { productUomId?: string | null; unitId?: string | null },
  ): Promise<{ productUomId: string | null; enteredUnitId: string | null; conversionToBase: Prisma.Decimal }> {
    const db = client ?? this.prisma;
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, deletedAt: true, unitId: true },
    });
    if (!product || product.deletedAt != null) {
      throw new NotFoundException({ messageKey: 'inventory.productNotFound', message: 'Product not found or deleted' });
    }

    if (input.productUomId) {
      const row = await db.productUom.findUnique({ where: { id: input.productUomId } });
      if (!row || row.productId !== productId) {
        throw new BadRequestException({
          messageKey: 'products.uomInvalidReference',
          message: 'The packaging unit does not belong to this product.',
          errors: [{ field: 'productUomId', code: 'validation.invalidReference' }],
        });
      }
      if (!row.isActive) {
        throw new BadRequestException({
          messageKey: 'products.uomInactive',
          message: 'The selected packaging unit is inactive.',
          errors: [{ field: 'productUomId', code: 'products.uomInactive' }],
        });
      }
      return {
        productUomId: row.id,
        enteredUnitId: row.unitId,
        conversionToBase: new Prisma.Decimal(row.conversionToBase),
      };
    }

    if (input.unitId) {
      if (product.unitId && input.unitId === product.unitId) {
        return { productUomId: null, enteredUnitId: product.unitId, conversionToBase: new Prisma.Decimal(1) };
      }
      const row = await db.productUom.findFirst({ where: { productId, unitId: input.unitId } });
      if (!row) {
        throw new BadRequestException({
          messageKey: 'products.uomInvalidReference',
          message: 'The selected unit is not usable for this product.',
          errors: [{ field: 'unitId', code: 'validation.invalidReference' }],
        });
      }
      if (!row.isActive) {
        throw new BadRequestException({
          messageKey: 'products.uomInactive',
          message: 'The selected unit is inactive.',
          errors: [{ field: 'unitId', code: 'products.uomInactive' }],
        });
      }
      return {
        productUomId: row.id,
        enteredUnitId: row.unitId,
        conversionToBase: new Prisma.Decimal(row.conversionToBase),
      };
    }

    return { productUomId: null, enteredUnitId: product.unitId ?? null, conversionToBase: new Prisma.Decimal(1) };
  }

  async convert(client: any, productId: string, input: ConversionInput): Promise<ConversionResult> {
    const enteredQuantity = new Prisma.Decimal(input.quantity ?? 0);
    const factor = await this.resolveFactor(client, productId, {
      productUomId: input.productUomId,
      unitId: input.unitId,
    });
    return {
      productUomId: factor.productUomId,
      enteredUnitId: factor.enteredUnitId,
      conversionToBase: factor.conversionToBase,
      enteredQuantity,
      baseQuantity: computeBaseQuantity(enteredQuantity, factor.conversionToBase),
    };
  }
}
