import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  @Permissions('department:create')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.create(dto, ctx);
  }

  @Get()
  @Permissions('department:read')
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string; branchId?: string; administrationId?: string; classification?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      administrationId: query.administrationId,
      classification: query.classification,
    }, ctx);
  }

  @Get('tree')
  @Permissions('department:read')
  @ApiOperation({ summary: 'Get department tree' })
  getTree(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.getTree(ctx);
  }

  @Get(':id')
  @Permissions('department:read')
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('department:update')
  @ApiOperation({ summary: 'Update department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.update(id, dto, ctx);
  }

  @Post(':id/classify')
  @Permissions('department:classify')
  @ApiOperation({ summary: 'Set department classification' })
  classify(@Param('id') id: string, @Body() body: { classification: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.classify(id, body.classification, ctx);
  }

  @Delete(':id')
  @Permissions('department:delete')
  @ApiOperation({ summary: 'Soft delete department' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.departmentsService.remove(id, ctx);
  }
}
