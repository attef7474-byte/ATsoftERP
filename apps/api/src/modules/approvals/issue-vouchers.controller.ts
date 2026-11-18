import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { ApprovalsService } from './approvals.service';
import { IssueVoucherLookupsService } from './issue-voucher-lookups.service';
import { IssueCandidateQueryDto, IssueVoucherQueryDto, IssueWarehouseQueryDto } from './dto/issue-voucher-query.dto';

/** Read orchestration only. Native controllers own every write and transition. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({
  path: 'inventory/issues',
  version: '1'
})
export class IssueVouchersController {
  constructor(private readonly approvals: ApprovalsService, private readonly lookups: IssueVoucherLookupsService) {}
  @Get()
  list(@Query()
  query: IssueVoucherQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.approvals.list(query, userId, ctx, true);
  }
  @Get('candidates')
  candidates(@Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.candidates(query, userId, ctx);
  }
  @Get('warehouses')
  warehouses(@Query()
  query: IssueWarehouseQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.warehouses(query, userId, ctx);
  }
  @Get('warehouses/:id')
  warehouse(@Param('id')
  id: string, @Query()
  query: IssueWarehouseQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.warehouses(query, userId, ctx, id);
  }
  @Get('locations')
  locations(@Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.locations(query, userId, ctx);
  }
  @Get('locations/:id')
  location(@Param('id')
  id: string, @Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.locations(query, userId, ctx, id);
  }
  @Get('stock')
  stock(@Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.stock(query, userId, ctx);
  }
  @Get('candidates/:id')
  candidate(@Param('id')
  id: string, @Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.candidate(id, query, userId, ctx);
  }
  @Get('stock/:id')
  stockIdentity(@Param('id')
  id: string, @Query()
  query: IssueCandidateQueryDto, @CurrentUser('id')
  userId: string, @CurrentActiveContext()
  ctx: ActiveOperationalContext) {
    return this.lookups.stockIdentity(id, query, userId, ctx);
  }
}
