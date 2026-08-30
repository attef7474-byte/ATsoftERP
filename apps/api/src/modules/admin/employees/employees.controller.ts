import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @Permissions('operational-person:create')
  @ApiOperation({ summary: 'Create an employee identity and its initial placement in the active branch' })
  create(@Body() dto: CreateEmployeeDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.create(dto, ctx);
  }

  @Get()
  @Permissions('operational-person:read')
  @ApiOperation({ summary: 'List employees visible in the active branch (derived through current assignments)' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; isActive?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      isActive: query.isActive,
    }, ctx);
  }

  @Get(':id')
  @Permissions('operational-person:read')
  @ApiOperation({ summary: 'Get an employee available in the active branch' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('operational-person:update')
  @ApiOperation({ summary: 'Update employee identity/profile data (does not change branch placement)' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.update(id, dto, ctx);
  }

  @Post(':id/deactivate')
  @Permissions('operational-person:deactivate')
  @ApiOperation({ summary: 'Deactivate an employee (preserves all history)' })
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.deactivate(id, ctx);
  }

  @Post(':id/activate')
  @Permissions('operational-person:deactivate')
  @ApiOperation({ summary: 'Activate an employee' })
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.activate(id, ctx);
  }

  @Delete(':id')
  @Permissions('operational-person:delete')
  @ApiOperation({ summary: 'Safe delete an employee (blocked when any related records exist)' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.employeesService.remove(id, ctx);
  }
}
