import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  @Permissions('companies:create')
  @ApiOperation({ summary: 'Create a company' })
  create(@Body() dto: CreateCompanyDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.companiesService.create(dto, ctx);
  }

  @Get()
  @Permissions('companies:read')
  @ApiOperation({ summary: 'List companies' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.companiesService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
    }, ctx);
  }

  @Get(':id')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'Get company by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.companiesService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('companies:update')
  @ApiOperation({ summary: 'Update company' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.companiesService.update(id, dto, ctx);
  }

  @Delete(':id')
  @Permissions('companies:delete')
  @ApiOperation({ summary: 'Soft delete company' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.companiesService.remove(id, ctx);
  }
}
