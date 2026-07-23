import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  @Permissions('departments:create')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @Permissions('departments:read')
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string; branchId?: string; administrationId?: string }) {
    return this.departmentsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
      branchId: query.branchId,
      administrationId: query.administrationId,
    });
  }

  @Get('tree')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Get department tree' })
  getTree(@Query('companyId') companyId: string) {
    return this.departmentsService.getTree(companyId);
  }

  @Get(':id')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('departments:update')
  @ApiOperation({ summary: 'Update department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('departments:delete')
  @ApiOperation({ summary: 'Soft delete department' })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
