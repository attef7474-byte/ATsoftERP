import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryCountLinesService } from './inventory-count-lines.service';
import { CreateInventoryCountLineDto } from './dto/create-inventory-count-line.dto';
import { UpdateInventoryCountLineDto } from './dto/update-inventory-count-line.dto';
import { CountInventoryCountLineDto } from './dto/count-inventory-count-line.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller()
@ApiTags('Inventory Count Lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryCountLinesController {
  constructor(private service: InventoryCountLinesService) {}

  @Get('inventory/counts/:countId/lines')
  @Permissions('inventory-count-line:read')
  @ApiOperation({ summary: 'List count lines for a count' })
  findByCountId(@Param('countId') countId: string) {
    return this.service.findByCountId(countId);
  }

  @Post('inventory/counts/:countId/lines')
  @Permissions('inventory-count-line:create')
  @ApiOperation({ summary: 'Create count line' })
  create(
    @Param('countId') countId: string,
    @Body() dto: CreateInventoryCountLineDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(countId, dto, userId);
  }

  @Get('inventory/count-lines/:id')
  @Permissions('inventory-count-line:read')
  @ApiOperation({ summary: 'Get count line by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch('inventory/count-lines/:id')
  @Permissions('inventory-count-line:update')
  @ApiOperation({ summary: 'Update count line' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryCountLineDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch('inventory/count-lines/:id/count')
  @Permissions('inventory-count-line:count')
  @ApiOperation({ summary: 'Record counted quantity' })
  countLine(@Param('id') id: string, @Body() dto: CountInventoryCountLineDto, @CurrentUser('id') userId: string) {
    return this.service.countLine(id, dto, userId);
  }

  @Patch('inventory/count-lines/:id/verify')
  @Permissions('inventory-count-line:verify')
  @ApiOperation({ summary: 'Verify counted line' })
  verify(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.verify(id, userId);
  }
}
