import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { SPARE_PART_ISSUE_PERMISSION_KEYS } from './spare-part-issues.constants';
import { SparePartIssuesService } from './spare-part-issues.service';
import {
  CancelSparePartIssueApprovalDto,
  CancelSparePartIssueDto,
  CreateSparePartIssueDto,
  RejectSparePartIssueDto,
  SparePartIssueQueryDto,
  UpdateSparePartIssueDto,
  WithdrawSparePartIssueDto,
} from './dto/spare-part-issue.dto';

@ApiTags('Spare-Part Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/spare-part-issues', version: '1' })
export class SparePartIssuesController {
  constructor(private readonly service: SparePartIssuesService) {}

  @Post()
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create a DRAFT standalone spare-part issue linked to a DRAFT OUT movement' })
  create(@Body() dto: CreateSparePartIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List spare-part issues scoped to the active company and branch' })
  findAll(@Query() query: SparePartIssueQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get a spare-part issue by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update a DRAFT spare-part issue and its linked DRAFT movement atomically' })
  update(@Param('id') id: string, @Body() dto: UpdateSparePartIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/submit')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.submit)
  @ApiOperation({ summary: 'Requester submits a DRAFT spare-part issue to the warehouse' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submit(id, userId, ctx);
  }

  @Patch(':id/withdraw')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.withdraw)
  @ApiOperation({ summary: 'Requester withdraws a SUBMITTED issue back to DRAFT before the warehouse decides' })
  withdraw(@Param('id') id: string, @Body() dto: WithdrawSparePartIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.withdraw(id, dto, userId, ctx);
  }

  @Patch(':id/approve')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.approve)
  @ApiOperation({ summary: 'Warehouse approves a SUBMITTED request (separate actor from the requester)' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx);
  }

  @Patch(':id/reject')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.reject)
  @ApiOperation({ summary: 'Warehouse rejects a SUBMITTED request with a mandatory reason' })
  reject(@Param('id') id: string, @Body() dto: RejectSparePartIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reject(id, dto, userId, ctx);
  }

  @Patch(':id/cancel-approval')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.cancelApproval)
  @ApiOperation({ summary: 'Warehouse cancels a prior approval before posting and returns the request to SUBMITTED' })
  cancelApproval(@Param('id') id: string, @Body() dto: CancelSparePartIssueApprovalDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancelApproval(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.post)
  @ApiOperation({ summary: 'Post an APPROVED issue through the canonical InventoryMovement authority' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(SPARE_PART_ISSUE_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT, SUBMITTED or REJECTED issue and its DRAFT movement' })
  cancel(@Param('id') id: string, @Body() dto: CancelSparePartIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }
}
