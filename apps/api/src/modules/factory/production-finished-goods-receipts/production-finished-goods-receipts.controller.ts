import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductionFinishedGoodsReceiptsService } from './production-finished-goods-receipts.service';
import { PRODUCTION_FG_RECEIPT_PERMISSION_KEYS } from './production-finished-goods-receipts.constants';
import {
  CancelFgReceiptDto,
  CreateFgReceiptDto,
  FgReceiptQueryDto,
  ReverseFgReceiptDto,
  UpdateFgReceiptDto,
} from './dto/production-finished-goods-receipt.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Finished-Goods Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production/finished-goods-receipts', version: '1' })
export class ProductionFinishedGoodsReceiptsController {
  constructor(private readonly service: ProductionFinishedGoodsReceiptsService) {}

  @Post()
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create a DRAFT finished-goods receipt linked to a DRAFT inventory movement' })
  create(@Body() dto: CreateFgReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List finished-goods receipts scoped to the active context' })
  findAll(@Query() query: FgReceiptQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('runs/:runId')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List finished-goods receipts for a production run' })
  getRunReceipts(@Param('runId') runId: string, @Query() query: FgReceiptQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRunReceipts(runId, query, ctx);
  }

  @Get(':id')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get finished-goods receipt by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update a DRAFT finished-goods receipt and its linked DRAFT movement' })
  update(@Param('id') id: string, @Body() dto: UpdateFgReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.post)
  @ApiOperation({ summary: 'Post the receipt and its inventory movement atomically (one ledger effect)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT finished-goods receipt and its DRAFT movement' })
  cancel(@Param('id') id: string, @Body() dto: CancelFgReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Post(':id/reverse')
  @Permissions(PRODUCTION_FG_RECEIPT_PERMISSION_KEYS.reverse)
  @ApiOperation({ summary: 'Create a DRAFT reversal receipt with the inverted ledger effect' })
  reverse(@Param('id') id: string, @Body() dto: ReverseFgReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reverse(id, dto, userId, ctx);
  }
}
