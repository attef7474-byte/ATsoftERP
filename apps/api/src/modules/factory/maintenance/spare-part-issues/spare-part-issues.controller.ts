import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SparePartIssuesService } from './spare-part-issues.service';
import {
  CreateSparePartIssueDto,
  ReturnSparePartIssueDto,
} from './dto/create-spare-part-issue.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

/**
 * R4R — canonical "صرف قطع الغيار" (Spare Part Issue) API.
 *
 * A spare-part issue is an independent inventory transaction. It is deliberately NOT
 * nested under the maintenance request resource so that the warehouse transaction can
 * never be confused with, or driven from, the maintenance request form.
 *
 * Permissions are the ALREADY SEEDED `maintenance-stock-issue:*` keys, reused unchanged:
 * the capability did not change, only the route shape. Introducing
 * `spare-part-issue:*` synonyms would have created permissions that no role holds and
 * that no seed defines — the same enforced-but-unseeded defect that existed on
 * `operationTypes:*`.
 */
@ApiTags('Spare Part Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'spare-part-issues', version: '1' })
export class SparePartIssuesController {
  constructor(private service: SparePartIssuesService) {}

  @Get()
  @Permissions('maintenance-stock-issue:read')
  @ApiOperation({
    summary: 'List issuable maintenance spare-part requirements for the issue desk',
    description:
      'Returns APPROVED/RESERVED maintenance requirements in the active company/branch whose canonical spare part can be issued, with the remaining issuable quantity and the current warehouse balance. Tenant-scoped by the owning machine.',
  })
  findAll(
    @Query() query: { page?: string; limit?: string; search?: string; requestId?: string; warehouseId?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.listIssuable(
      {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        search: query.search,
        requestId: query.requestId,
        warehouseId: query.warehouseId,
      },
      ctx,
    );
  }

  @Post()
  @Permissions('maintenance-stock-issue:create')
  @ApiOperation({
    summary: 'Issue spare parts from a warehouse (canonical spare part issue transaction)',
    description:
      'Physically deducts stock, records the inventory movement, records the spare-part condition movement, records the machine installed part and — for a replacement — records the removed part and the replacement history. The spare part, machine, machine component and approved quantity are resolved server-side from the requirement; only the warehouse, quantity and replacement facts come from the payload. Supply clientRequestId for idempotent submission.',
  })
  create(
    @Body() dto: CreateSparePartIssueDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.issue(dto, userId, ctx);
  }

  @Post(':requiredPartId/return')
  @Permissions('maintenance-stock-issue:create')
  @ApiOperation({
    summary: 'Return unused, still-usable issued spare-part stock to the issuing warehouse',
    description:
      'Compensating inventory transaction against a previous canonical issue on the same requirement. Posts a MAINTENANCE_RETURN (direction IN) movement into the SAME warehouse the stock was issued from and restores it as USABLE balance. It is NOT a damaged-part return: no condition can be expressed here, and any removed-part field is rejected as an unknown field. Returning a removed/damaged part is expressed on the issue itself via replacementAction and removedPart* fields.',
  })
  returnStock(
    @Param('requiredPartId') requiredPartId: string,
    @Body() dto: ReturnSparePartIssueDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.return(dto, requiredPartId, dto.maintenanceRequestId, userId, ctx);
  }

  @Get(':requiredPartId/movements')
  @Permissions('maintenance-stock-issue:read')
  @ApiOperation({
    summary: 'Immutable inventory movements produced by the spare part issues of a requirement',
  })
  movements(
    @Param('requiredPartId') requiredPartId: string,
    @Query('maintenanceRequestId') maintenanceRequestId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.movements(requiredPartId, maintenanceRequestId, ctx);
  }
}
