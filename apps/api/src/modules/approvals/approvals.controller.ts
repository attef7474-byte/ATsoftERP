import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { WarehouseApprovalsQueryDto } from './dto/warehouse-approvals-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

/**
 * Unified warehouse approvals inbox. It is an aggregation/read layer: the
 * underlying native read permission per request family is enforced in the
 * service (any-of), so there is no umbrella permission that could grant access
 * or approval rights beyond the real permissions.
 */
@ApiTags('Warehouse Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/approvals', version: '1' })
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'List pending issue requests from all readable categories (aggregation only)' })
  list(
    @Query() query: WarehouseApprovalsQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.list(query, userId, ctx);
  }
}
