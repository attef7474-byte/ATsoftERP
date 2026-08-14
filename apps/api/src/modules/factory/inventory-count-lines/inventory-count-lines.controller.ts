import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryCountLinesService } from './inventory-count-lines.service';
import { CreateInventoryCountLineDto } from './dto/create-inventory-count-line.dto';
import { UpdateInventoryCountLineDto } from './dto/update-inventory-count-line.dto';
import { CountInventoryCountLineDto } from './dto/count-inventory-count-line.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Controller()
@ApiTags('Inventory Count Lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryCountLinesController {
  constructor(private service: InventoryCountLinesService) {}

  @Get('inventory/counts/:countId/lines')
  @Permissions('inventory-count-line:read')
  @ApiOperation({ summary: 'List count lines for a count' })
  findByCountId(
    @Param('countId') countId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findByCountId(countId, ctx);
  }

  @Post('inventory/counts/:countId/lines')
  @Permissions('inventory-count-line:create')
  @ApiOperation({ summary: 'Create count line' })
  create(
    @Param('countId') countId: string,
    @Body() dto: CreateInventoryCountLineDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.create(countId, dto, userId, ctx);
  }

  @Get('inventory/count-lines/:id')
  @Permissions('inventory-count-line:read')
  @ApiOperation({ summary: 'Get count line by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findOne(id, ctx);
  }

  @Patch('inventory/count-lines/:id')
  @Permissions('inventory-count-line:update')
  @ApiOperation({ summary: 'Update count line' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCountLineDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch('inventory/count-lines/:id/count')
  @Permissions('inventory-count-line:count')
  @ApiOperation({ summary: 'Record counted quantity' })
  countLine(
    @Param('id') id: string,
    @Body() dto: CountInventoryCountLineDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.countLine(id, dto, userId, ctx);
  }

  @Patch('inventory/count-lines/:id/verify')
  @Permissions('inventory-count-line:verify')
  @ApiOperation({ summary: 'Verify counted line' })
  verify(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.verify(id, userId, ctx);
  }
}
