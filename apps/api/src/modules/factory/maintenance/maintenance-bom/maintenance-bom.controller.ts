import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceBomService } from './maintenance-bom.service';
import {
  QueryMaintenanceBomDto, CreateMaintenanceBomDto, UpdateMaintenanceBomDto,
  CreateMaintenanceBomVersionDto, QueryBomVersionDto,
  CreateMaintenanceBomItemDto, UpdateMaintenanceBomItemDto,
} from './dto/maintenance-bom.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance BOM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/bom', version: '1' })
export class MaintenanceBomController {
  constructor(private service: MaintenanceBomService) {}

  @Post()
  @Permissions('maintenance-bom:create')
  @ApiOperation({ summary: 'Create a new BOM' })
  create(@Body() dto: CreateMaintenanceBomDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'List BOMs with optional filters' })
  findAll(@Query() query: QueryMaintenanceBomDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'Get BOM by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Permissions('maintenance-bom:update')
  @ApiOperation({ summary: 'Update BOM' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceBomDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/activate')
  @Permissions('maintenance-bom:update')
  @ApiOperation({ summary: 'Activate BOM' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('maintenance-bom:update')
  @ApiOperation({ summary: 'Deactivate BOM' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.deactivate(id, userId);
  }

  @Delete(':id')
  @Permissions('maintenance-bom:delete')
  @ApiOperation({ summary: 'Soft delete BOM' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }

  // ── Versions ──
  @Get(':id/versions')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'List BOM versions' })
  getVersions(@Param('id') id: string, @Query() query: QueryBomVersionDto) {
    return this.service.getVersions(id, query);
  }

  @Post(':id/versions')
  @Permissions('maintenance-bom:create')
  @ApiOperation({ summary: 'Create new BOM version' })
  createVersion(@Param('id') id: string, @Body() dto: CreateMaintenanceBomVersionDto, @CurrentUser('id') userId: string) {
    return this.service.createVersion(id, dto, userId);
  }

  @Post(':id/versions/:versionId/activate')
  @Permissions('maintenance-bom:update')
  @ApiOperation({ summary: 'Activate a specific BOM version' })
  activateVersion(@Param('id') id: string, @Param('versionId') versionId: string, @CurrentUser('id') userId: string) {
    return this.service.activateVersion(id, versionId, userId);
  }

  // ── Items ──
  @Get(':id/versions/:versionId/items')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'List items in a BOM version' })
  getItems(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.getItems(versionId);
  }

  @Post(':id/versions/:versionId/items')
  @Permissions('maintenance-bom:create')
  @ApiOperation({ summary: 'Add item to BOM version' })
  addItem(@Param('id') id: string, @Param('versionId') versionId: string, @Body() dto: CreateMaintenanceBomItemDto, @CurrentUser('id') userId: string) {
    return this.service.addItem(versionId, dto, userId);
  }

  @Patch(':id/versions/:versionId/items/:itemId')
  @Permissions('maintenance-bom:update')
  @ApiOperation({ summary: 'Update BOM item' })
  updateItem(@Param('id') id: string, @Param('versionId') versionId: string, @Param('itemId') itemId: string, @Body() dto: UpdateMaintenanceBomItemDto, @CurrentUser('id') userId: string) {
    return this.service.updateItem(itemId, dto, userId);
  }

  @Delete(':id/versions/:versionId/items/:itemId')
  @Permissions('maintenance-bom:delete')
  @ApiOperation({ summary: 'Remove BOM item' })
  removeItem(@Param('id') id: string, @Param('versionId') versionId: string, @Param('itemId') itemId: string, @CurrentUser('id') userId: string) {
    return this.service.removeItem(itemId, userId);
  }

  // ── By machine / component ──
  @Get('by-machine/:machineId')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'Get BOMs by machine' })
  getByMachine(@Param('machineId') machineId: string) {
    return this.service.getByMachine(machineId);
  }

  @Get('by-component/:componentId')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'Get BOMs by component' })
  getByComponent(@Param('componentId') componentId: string) {
    return this.service.getByComponent(componentId);
  }

  // ── Active version with items ──
  @Get(':id/active-version')
  @Permissions('maintenance-bom:read')
  @ApiOperation({ summary: 'Get active version with items' })
  getActiveVersion(@Param('id') id: string) {
    return this.service.getActiveVersion(id);
  }
}
