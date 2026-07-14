import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MachinePartsService } from './machine-parts.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';
import { UpdateMachinePartDto } from './dto/update-machine-part.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Machine Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-parts', version: '1' })
export class MachinePartsController {
  constructor(private service: MachinePartsService) {}

  @Post()
  @Permissions('machine-part:create')
  @ApiOperation({ summary: 'Create machine part' })
  create(@Body() dto: CreateMachinePartDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('machine-part:read')
  @ApiOperation({ summary: 'List machine parts' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; machineId?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
    });
  }

  @Get(':id')
  @Permissions('machine-part:read')
  @ApiOperation({ summary: 'Get machine part by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('machine-part:update')
  @ApiOperation({ summary: 'Update machine part' })
  update(@Param('id') id: string, @Body() dto: UpdateMachinePartDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('machine-part:deactivate')
  @ApiOperation({ summary: 'Delete machine part' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }

  @Patch(':id/activate')
  @Permissions('machine-part:activate')
  @ApiOperation({ summary: 'Activate machine part (not supported)' })
  activate() {
    return this.service.activate();
  }

  @Patch(':id/deactivate')
  @Permissions('machine-part:deactivate')
  @ApiOperation({ summary: 'Deactivate machine part (not supported)' })
  deactivate() {
    return this.service.deactivate();
  }
}
