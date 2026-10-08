import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COST_PURPOSE_VALUES } from '../../../../../common/cost-purpose/cost-purpose.constants';

/**
 * R4R — canonical Spare Part Issue request.
 *
 * A Spare Part Issue is an INVENTORY TRANSACTION, not part of a maintenance request
 * form. It is therefore expressed as its own first-class document: it names the
 * approved maintenance requirement it is satisfying (`requiredPartId`), the warehouse
 * it leaves from, and the maintenance context it is applied to.
 *
 * The identity of the spare part, the machine, the machine component and the
 * approved quantity are NEVER taken from this payload. They are resolved server-side
 * from `requiredPartId` inside the active company/branch, exactly as the proven
 * stock-issue authority already does. This is what makes duplicate submission of the
 * same requirement impossible to smuggle past validation.
 */
export class CreateSparePartIssueDto {
  @ApiProperty({
    description:
      'MaintenanceRequestRequiredPart id of the APPROVED/RESERVED requirement this issue satisfies. Server-authoritative: the spare part, machine, component and approved quantity are resolved from it.',
  })
  @IsString()
  requiredPartId: string;

  @ApiProperty({
    description:
      'MaintenanceRequest id that owns the requirement. Must match the requirement record; a mismatch is rejected.',
  })
  @IsString()
  maintenanceRequestId: string;

  @ApiProperty({ description: 'Warehouse the stock physically leaves from.' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: 'Quantity to issue out of the warehouse. Must be positive.' })
  @IsNumber()
  @Min(0.001)
  issuedQuantity: number;

  @ApiPropertyOptional({
    description:
      'Caller-supplied idempotency key. Written to inventory_movements.requestId, which carries a SQL Server filtered unique index on (companyId, branchId, requestId). A repeated submission of the same key returns the original movement instead of deducting stock twice.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['MAINTENANCE', 'OPERATION', 'PROJECT', 'QUALITY', 'SERVICES', 'GENERAL'] })
  @IsOptional()
  @IsString()
  costOwnerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costOwnerAdministrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costDepartmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costProductionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costMachineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costMachineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receivedByUserId?: string;

  @ApiPropertyOptional({
    enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'],
  })
  @IsOptional()
  @IsString()
  issuedStockCondition?: string;

  @ApiPropertyOptional({ enum: ['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'] })
  @IsOptional()
  @IsString()
  replacementAction?: string;

  @ApiPropertyOptional({
    description:
      'MachineInstalledPart id of the ACTIVE installed part being removed. Required for RETURNED_REMOVED_PART and NO_REMOVED_PART; rejected for NEW_INSTALLATION. The old spare-part and product identity are always derived server-side.',
  })
  @IsOptional()
  @IsString()
  oldInstalledPartId?: string;

  @ApiPropertyOptional({
    enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'],
  })
  @IsOptional()
  @IsString()
  removedPartCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  removedPartWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  removedPartQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  removedPartReturnedByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noReturnReason?: string;

  @ApiPropertyOptional({ enum: COST_PURPOSE_VALUES })
  @IsOptional()
  @IsString()
  costPurpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costPurposeOverrideReason?: string;
}

/**
 * R4R — canonical Spare Part Issue RETURN of unused, still-usable issued stock.
 *
 * This is deliberately NOT a damaged-part return. It posts a `MAINTENANCE_RETURN`
 * movement (direction IN) into the SAME warehouse the stock was issued from and
 * restores `inventoryBalance` as USABLE quantity. It has no condition parameter,
 * so no damaged or removed part can be represented here.
 *
 * Returning a removed/damaged part is a different transaction and is expressed on the
 * ISSUE itself via `replacementAction` / `removedPartCondition` /
 * `removedPartWarehouseId` / `noReturnReason`, which route the old part to its
 * correct warehouse and condition. Sending any removed-part field here is rejected
 * by the global `forbidNonWhitelisted` validation pipe, so no damaged part can be
 * silently placed into usable stock through this route.
 */
export class ReturnSparePartIssueDto {
  @ApiProperty({
    description:
      'MaintenanceRequest id that owns the requirement this return is compensating.',
  })
  @IsString()
  maintenanceRequestId: string;

  @ApiProperty({
    description:
      'Quantity of UNUSED, still-usable issued stock to return into the issuing warehouse. Restored as usable balance. Must be positive and must not exceed the net issued quantity of the requirement.',
  })
  @IsNumber()
  @Min(0.001)
  returnQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
