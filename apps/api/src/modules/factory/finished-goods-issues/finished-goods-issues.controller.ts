import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinishedGoodsIssuesService } from './finished-goods-issues.service';
import { FINISHED_GOODS_ISSUE_PERMISSION_KEYS } from './finished-goods-issues.constants';
import {
  CancelFinishedGoodsIssueApprovalDto,
  CancelFinishedGoodsIssueDto,
  CreateFinishedGoodsIssueDto,
  FinishedGoodsIssueQueryDto,
  RejectFinishedGoodsIssueDto,
  ReverseFinishedGoodsIssueDto,
  UpdateFinishedGoodsIssueDto,
  WithdrawFinishedGoodsIssueDto,
} from './dto/finished-goods-issue.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Finished-Goods Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/finished-goods-issues', version: '1' })
export class FinishedGoodsIssuesController {
  constructor(private readonly service: FinishedGoodsIssuesService) {}

  @Post()
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create a DRAFT finished-goods issue request linked to a DRAFT OUT inventory movement' })
  create(@Body() dto: CreateFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List finished-goods issues scoped to the active context' })
  findAll(@Query() query: FinishedGoodsIssueQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get a finished-goods issue by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update a DRAFT finished-goods issue and its linked DRAFT movement' })
  update(@Param('id') id: string, @Body() dto: UpdateFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/submit')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.submit)
  @ApiOperation({ summary: 'Requester submits a DRAFT issue request to the warehouse' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submit(id, userId, ctx);
  }

  @Patch(':id/withdraw')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.withdraw)
  @ApiOperation({ summary: 'Requester withdraws a SUBMITTED request back to DRAFT before the warehouse decides' })
  withdraw(@Param('id') id: string, @Body() dto: WithdrawFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.withdraw(id, dto, userId, ctx);
  }

  @Patch(':id/approve')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.approve)
  @ApiOperation({ summary: 'Warehouse approves a SUBMITTED request (separate actor from the requester)' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx);
  }

  @Patch(':id/reject')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.reject)
  @ApiOperation({ summary: 'Warehouse rejects a SUBMITTED request with a mandatory reason' })
  reject(@Param('id') id: string, @Body() dto: RejectFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reject(id, dto, userId, ctx);
  }

  @Patch(':id/cancel-approval')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.cancelApproval)
  @ApiOperation({ summary: 'Warehouse cancels a prior approval before posting and returns the request to SUBMITTED' })
  cancelApproval(@Param('id') id: string, @Body() dto: CancelFinishedGoodsIssueApprovalDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancelApproval(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.post)
  @ApiOperation({ summary: 'Post an APPROVED issue and its OUT inventory movement atomically (one ledger effect)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT, SUBMITTED or REJECTED finished-goods issue and its DRAFT movement' })
  cancel(@Param('id') id: string, @Body() dto: CancelFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Post(':id/reverse')
  @Permissions(FINISHED_GOODS_ISSUE_PERMISSION_KEYS.reverse)
  @ApiOperation({ summary: 'Create a DRAFT reversal issue with the inverted (IN) ledger effect' })
  reverse(@Param('id') id: string, @Body() dto: ReverseFinishedGoodsIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reverse(id, dto, userId, ctx);
  }
}
