import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { GeneralInventoryIssuesService } from './general-inventory-issues.service';
import { GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS } from './general-inventory-issues.constants';
import {
  CancelGeneralInventoryIssueApprovalDto,
  CancelGeneralInventoryIssueDto,
  CreateGeneralInventoryIssueDto,
  GeneralInventoryIssueQueryDto,
  RejectGeneralInventoryIssueDto,
  ReverseGeneralInventoryIssueDto,
  UpdateGeneralInventoryIssueDto,
  WithdrawGeneralInventoryIssueDto,
} from './dto/general-inventory-issue.dto';

@ApiTags('General Inventory Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/general-issues', version: '1' })
export class GeneralInventoryIssuesController {
  constructor(private readonly service: GeneralInventoryIssuesService) {}

  @Post()
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create a DRAFT general inventory issue linked to a DRAFT OUT inventory movement' })
  create(@Body() dto: CreateGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List general inventory issues scoped to the active context' })
  findAll(@Query() query: GeneralInventoryIssueQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get a general inventory issue by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update a DRAFT general inventory issue and its linked DRAFT movement' })
  update(@Param('id') id: string, @Body() dto: UpdateGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/submit')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.submit)
  @ApiOperation({ summary: 'Requester submits a DRAFT issue request to the warehouse' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submit(id, userId, ctx);
  }

  @Patch(':id/withdraw')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.withdraw)
  @ApiOperation({ summary: 'Requester withdraws a SUBMITTED request back to DRAFT before the warehouse decides' })
  withdraw(@Param('id') id: string, @Body() dto: WithdrawGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.withdraw(id, dto, userId, ctx);
  }

  @Patch(':id/approve')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.approve)
  @ApiOperation({ summary: 'Warehouse approves a SUBMITTED request (separate actor from the requester)' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx);
  }

  @Patch(':id/reject')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.reject)
  @ApiOperation({ summary: 'Warehouse rejects a SUBMITTED request with a mandatory reason' })
  reject(@Param('id') id: string, @Body() dto: RejectGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reject(id, dto, userId, ctx);
  }

  @Patch(':id/cancel-approval')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.cancelApproval)
  @ApiOperation({ summary: 'Warehouse cancels a prior approval before posting and returns the request to SUBMITTED' })
  cancelApproval(@Param('id') id: string, @Body() dto: CancelGeneralInventoryIssueApprovalDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancelApproval(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.post)
  @ApiOperation({ summary: 'Post an APPROVED issue and its OUT inventory movement atomically (one ledger effect)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT, SUBMITTED or REJECTED issue and its DRAFT movement' })
  cancel(@Param('id') id: string, @Body() dto: CancelGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Post(':id/reverse')
  @Permissions(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS.reverse)
  @ApiOperation({ summary: 'Create a DRAFT reversal issue with the inverted (IN) ledger effect' })
  reverse(@Param('id') id: string, @Body() dto: ReverseGeneralInventoryIssueDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reverse(id, dto, userId, ctx);
  }
}
