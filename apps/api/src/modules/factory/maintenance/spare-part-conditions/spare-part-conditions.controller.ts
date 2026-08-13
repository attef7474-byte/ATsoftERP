import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SparePartConditionService } from './spare-part-conditions.service';
import { RecordConditionMovementDto, QueryConditionBalanceDto, QueryConditionMovementDto } from './dto/condition-movement.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Spare Part Conditions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'spare-part-conditions', version: '1' })
export class SparePartConditionController {
  constructor(private service: SparePartConditionService) {}

  @Get('balances')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'List condition balances with optional filters' })
  getBalances(@Query() query: QueryConditionBalanceDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBalances(query, ctx);
  }

  @Get('balances/:id')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'Get condition balance by ID' })
  getBalanceById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBalanceById(id, ctx);
  }

  @Get('by-spare-part/:sparePartId')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'Get all condition balances for a spare part' })
  getBalancesBySparePart(@Param('sparePartId') sparePartId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBalancesBySparePart(sparePartId, ctx);
  }

  @Get('by-warehouse/:warehouseId')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'Get all condition balances in a warehouse' })
  getBalancesByWarehouse(@Param('warehouseId') warehouseId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBalancesByWarehouse(warehouseId, ctx);
  }

  @Post('movements')
  @Permissions('spare-part-conditions:create')
  @ApiOperation({ summary: 'Record a condition movement (IN/OUT)' })
  recordMovement(@Body() dto: RecordConditionMovementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recordMovement(dto, userId, ctx);
  }

  @Get('movements')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'List condition movements with filters' })
  getMovements(@Query() query: QueryConditionMovementDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMovements(query, ctx);
  }

  @Get('movements/:id')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'Get condition movement by ID' })
  getMovementById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMovementById(id, ctx);
  }

  @Get('by-required-part/:requiredPartId')
  @Permissions('spare-part-conditions:read')
  @ApiOperation({ summary: 'Get condition movements for a required part line' })
  getMovementsByRequiredPart(@Param('requiredPartId') requiredPartId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMovementsByRequiredPart(requiredPartId, ctx);
  }
}
