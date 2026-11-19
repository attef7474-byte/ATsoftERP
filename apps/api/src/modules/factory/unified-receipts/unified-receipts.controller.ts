import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { UnifiedReceiptsService } from './unified-receipts.service';
import { UnifiedReceiptQueryDto } from './dto/unified-receipt-query.dto';

/**
 * No @Permissions decorator: the aggregated read intentionally accepts either
 * native read key. UnifiedReceiptsService resolves the exact native grants and
 * filters out documents whose authority the actor may not read.
 */
@ApiTags('Unified Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, InventoryLockGuard)
@Controller({ path: 'inventory/receipts', version: '1' })
export class UnifiedReceiptsController {
  constructor(private readonly service: UnifiedReceiptsService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Native receipt capabilities for the active user' })
  capabilities(@CurrentUser('id') userId: string) {
    return this.service.capabilities(userId);
  }

  @Get()
  @ApiOperation({ summary: 'List receipt vouchers from both native authorities' })
  findAll(
    @Query() query: UnifiedReceiptQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findAll(query, userId, ctx);
  }

  @Get(':authority/:id')
  @ApiOperation({ summary: 'Get a normalized receipt voucher by native authority and id' })
  findOne(
    @Param('authority') authority: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findOne(authority, id, userId, ctx);
  }
}
