import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenancePersonnelService } from './maintenance-personnel.service';
import { CreateMaintenancePersonnelDto, UpdateMaintenancePersonnelDto } from './dto/create-maintenance-personnel.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance Personnel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/personnel', version: '1' })
export class MaintenancePersonnelController {
  constructor(private service: MaintenancePersonnelService) {}

  @Post()
  @Permissions('maintenance-personnel:create')
  @ApiOperation({ summary: 'Create maintenance personnel' })
  create(@Body() dto: CreateMaintenancePersonnelDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('maintenance-personnel:read')
  @ApiOperation({ summary: 'List maintenance personnel' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; role?: string; specialty?: string; isActive?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      role: query.role,
      specialty: query.specialty,
      isActive: query.isActive,
    });
  }

  @Get(':id')
  @Permissions('maintenance-personnel:read')
  @ApiOperation({ summary: 'Get maintenance personnel by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('maintenance-personnel:update')
  @ApiOperation({ summary: 'Update maintenance personnel' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenancePersonnelDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activate')
  @Permissions('maintenance-personnel:activate')
  @ApiOperation({ summary: 'Activate maintenance personnel' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Patch(':id/deactivate')
  @Permissions('maintenance-personnel:deactivate')
  @ApiOperation({ summary: 'Deactivate maintenance personnel' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Delete(':id')
  @Permissions('maintenance-personnel:delete')
  @ApiOperation({ summary: 'Delete maintenance personnel' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.remove(id);
  }
}
