import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryOpeningBalancesService } from './inventory-opening-balances.service';
import { CreateOpeningBalanceDto, CreateOpeningBalanceLineDto } from './dto/create-opening-balance.dto';
import { UpdateOpeningBalanceDto } from './dto/update-opening-balance.dto';
import { OpeningBalanceQueryDto } from './dto/opening-balance-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Opening Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/opening-balances', version: '1' })
export class InventoryOpeningBalancesController {
  constructor(private service: InventoryOpeningBalancesService) {}

  @Post()
  @Permissions('inventory:opening-balance:create')
  @ApiOperation({ summary: 'Create opening balance' })
  create(@Body() dto: CreateOpeningBalanceDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'List opening balances' })
  findAll(@Query() query: OpeningBalanceQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'Get opening balance by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Update opening balance' })
  update(@Param('id') id: string, @Body() dto: UpdateOpeningBalanceDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Post(':id/submit')
  @Permissions('inventory:opening-balance:submit')
  @ApiOperation({ summary: 'Submit opening balance' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.submit(id, userId, ctx); }

  @Post(':id/approve')
  @Permissions('inventory:opening-balance:approve')
  @ApiOperation({ summary: 'Approve opening balance' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.approve(id, userId, ctx); }

  @Post(':id/reject')
  @Permissions('inventory:opening-balance:reject')
  @ApiOperation({ summary: 'Reject opening balance' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.reject(id, userId, ctx); }

  @Post(':id/post')
  @Permissions('inventory:opening-balance:post')
  @ApiOperation({ summary: 'Post opening balance' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.post(id, userId, ctx); }

  @Post(':id/cancel')
  @Permissions('inventory:opening-balance:cancel')
  @ApiOperation({ summary: 'Cancel opening balance' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.cancel(id, userId, ctx); }

  @Delete(':id')
  @Permissions('inventory:opening-balance:delete-draft')
  @ApiOperation({ summary: 'Delete opening balance (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.remove(id, userId, ctx); }

  @Post(':id/lines')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Add line to opening balance' })
  addLine(@Param('id') id: string, @Body() dto: CreateOpeningBalanceLineDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addLine(id, dto, userId, ctx);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Update opening balance line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateOpeningBalanceLineDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateLine(id, lineId, dto, userId, ctx);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Delete opening balance line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeLine(id, lineId, userId, ctx);
  }

  @Get(':id/summary')
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'Get opening balance summary' })
  summary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.summary(id, ctx); }
}
