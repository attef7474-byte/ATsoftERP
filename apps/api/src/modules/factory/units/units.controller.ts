import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'units', version: '1' })
export class UnitsController {
  constructor(private service: UnitsService) {}

  @Post()
  @Permissions('unit:create')
  @ApiOperation({ summary: 'Create unit' })
  create(@Body() dto: CreateUnitDto) { return this.service.create(dto); }

  @Get()
  @Permissions('unit:read')
  @ApiOperation({ summary: 'List units' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; activeOnly?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      activeOnly: query.activeOnly,
    });
  }

  @Get(':id')
  @Permissions('unit:read')
  @ApiOperation({ summary: 'Get unit by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('unit:update')
  @ApiOperation({ summary: 'Update unit' })
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) { return this.service.update(id, dto); }

  @Patch(':id/activate')
  @Permissions('unit:activate')
  @ApiOperation({ summary: 'Activate unit' })
  activate(@Param('id') id: string) { return this.service.activate(id); }

  @Patch(':id/deactivate')
  @Permissions('unit:deactivate')
  @ApiOperation({ summary: 'Deactivate unit' })
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Delete(':id')
  @Permissions('unit:delete')
  @ApiOperation({ summary: 'Delete unit (only when unreferenced)' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
