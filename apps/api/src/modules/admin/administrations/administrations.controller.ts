import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdministrationsService } from './administrations.service';
import { CreateAdministrationDto } from './dto/create-administration.dto';
import { UpdateAdministrationDto } from './dto/update-administration.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Administrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'administrations', version: '1' })
export class AdministrationsController {
  constructor(private administrationsService: AdministrationsService) {}

  @Post()
  @Permissions('administrations:create')
  @ApiOperation({ summary: 'Create an administration' })
  create(@Body() dto: CreateAdministrationDto) {
    return this.administrationsService.create(dto);
  }

  @Get()
  @Permissions('administrations:read')
  @ApiOperation({ summary: 'List administrations' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string; branchId?: string; status?: string }) {
    return this.administrationsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
      branchId: query.branchId,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('administrations:read')
  @ApiOperation({ summary: 'Get administration by ID' })
  findOne(@Param('id') id: string) {
    return this.administrationsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('administrations:update')
  @ApiOperation({ summary: 'Update administration' })
  update(@Param('id') id: string, @Body() dto: UpdateAdministrationDto) {
    return this.administrationsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('administrations:delete')
  @ApiOperation({ summary: 'Soft delete administration' })
  remove(@Param('id') id: string) {
    return this.administrationsService.remove(id);
  }
}
