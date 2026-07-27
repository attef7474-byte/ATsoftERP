import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryOperationalReceiptsService } from './inventory-operational-receipts.service';
import { CreateOperationalReceiptDto } from './dto/create-operational-receipt.dto';
import { UpdateOperationalReceiptDto } from './dto/update-operational-receipt.dto';
import { OperationalReceiptQueryDto } from './dto/operational-receipt-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Inventory Operational Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/operational-receipts', version: '1' })
export class InventoryOperationalReceiptsController {
  constructor(private service: InventoryOperationalReceiptsService) {}

  @Post()
  @Permissions('inventory:operational-receipt:create')
  @ApiOperation({ summary: 'Create operational receipt' })
  create(@Body() dto: CreateOperationalReceiptDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'List operational receipts' })
  findAll(@Query() query: OperationalReceiptQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'Get operational receipt by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Update operational receipt' })
  update(@Param('id') id: string, @Body() dto: UpdateOperationalReceiptDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/submit')
  @Permissions('inventory:operational-receipt:submit')
  @ApiOperation({ summary: 'Submit operational receipt' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.submit(id, userId); }

  @Post(':id/approve')
  @Permissions('inventory:operational-receipt:approve')
  @ApiOperation({ summary: 'Approve operational receipt' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.approve(id, userId); }

  @Post(':id/reject')
  @Permissions('inventory:operational-receipt:reject')
  @ApiOperation({ summary: 'Reject operational receipt' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.reject(id, userId); }

  @Post(':id/post')
  @Permissions('inventory:operational-receipt:post')
  @ApiOperation({ summary: 'Post operational receipt' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Post(':id/cancel')
  @Permissions('inventory:operational-receipt:cancel')
  @ApiOperation({ summary: 'Cancel operational receipt' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('inventory:operational-receipt:delete-draft')
  @ApiOperation({ summary: 'Delete operational receipt (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }

  @Post(':id/lines')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Add line to operational receipt' })
  addLine(@Param('id') id: string, @Body() dto: any, @CurrentUser('id') userId: string) {
    return this.service.addLine(id, dto, userId);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Update operational receipt line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: any, @CurrentUser('id') userId: string) {
    return this.service.updateLine(id, lineId, dto, userId);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Delete operational receipt line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string) {
    return this.service.removeLine(id, lineId, userId);
  }

  @Get(':id/summary')
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'Get operational receipt summary' })
  summary(@Param('id') id: string) { return this.service.summary(id); }
}
