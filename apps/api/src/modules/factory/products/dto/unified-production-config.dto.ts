import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Production configuration carried inside the single canonical Product
 * create/update payload. This is NOT a second product identity: it only holds
 * production-specific configuration. The product name/code/general description
 * are never taken from here — the definition mirrors the Product identity.
 */
export class UnifiedProductionConfigDto {
  @ApiPropertyOptional({
    description: 'Whether this product is internally produced. When false the product production configuration is deactivated.',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Production process note (distinct from the generic product description).' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Default production unit (company/branch scoped ProductionUnit).' })
  @IsOptional()
  @IsString()
  defaultUnitId?: string;

  @ApiPropertyOptional({ description: 'Default production line.' })
  @IsOptional()
  @IsString()
  defaultLineId?: string;

  @ApiPropertyOptional({ description: 'Default issue/receipt warehouse.' })
  @IsOptional()
  @IsString()
  defaultWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Default cost center.' })
  @IsOptional()
  @IsString()
  defaultCostCenterId?: string;
}
