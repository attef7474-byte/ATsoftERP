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

@ApiTags('Inventory Opening Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/opening-balances', version: '1' })
export class InventoryOpeningBalancesController {
  constructor(private service: InventoryOpeningBalancesService) {}

  @Post()
  @Permissions('inventory:opening-balance:create')
  @ApiOperation({ summary: 'Create opening balance' })
  create(@Body() dto: CreateOpeningBalanceDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'List opening balances' })
  findAll(@Query() query: OpeningBalanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'Get opening balance by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Update opening balance' })
  update(@Param('id') id: string, @Body() dto: UpdateOpeningBalanceDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/submit')
  @Permissions('inventory:opening-balance:submit')
  @ApiOperation({ summary: 'Submit opening balance' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.submit(id, userId); }

  @Post(':id/approve')
  @Permissions('inventory:opening-balance:approve')
  @ApiOperation({ summary: 'Approve opening balance' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.approve(id, userId); }

  @Post(':id/reject')
  @Permissions('inventory:opening-balance:reject')
  @ApiOperation({ summary: 'Reject opening balance' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.reject(id, userId); }

  @Post(':id/post')
  @Permissions('inventory:opening-balance:post')
  @ApiOperation({ summary: 'Post opening balance' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Post(':id/cancel')
  @Permissions('inventory:opening-balance:cancel')
  @ApiOperation({ summary: 'Cancel opening balance' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('inventory:opening-balance:delete-draft')
  @ApiOperation({ summary: 'Delete opening balance (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }

  @Post(':id/lines')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Add line to opening balance' })
  addLine(@Param('id') id: string, @Body() dto: CreateOpeningBalanceLineDto, @CurrentUser('id') userId: string) {
    return this.service.addLine(id, dto, userId);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Update opening balance line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateOpeningBalanceLineDto>, @CurrentUser('id') userId: string) {
    return this.service.updateLine(id, lineId, dto, userId);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:opening-balance:update')
  @ApiOperation({ summary: 'Delete opening balance line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string) {
    return this.service.removeLine(id, lineId, userId);
  }

  @Get(':id/summary')
  @Permissions('inventory:opening-balance:read')
  @ApiOperation({ summary: 'Get opening balance summary' })
  summary(@Param('id') id: string) { return this.service.summary(id); }
}
