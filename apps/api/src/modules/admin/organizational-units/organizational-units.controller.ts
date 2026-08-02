import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationalUnitsService } from './organizational-units.service';
import { CreateOrganizationalUnitDto } from './dto/create-organizational-unit.dto';
import { UpdateOrganizationalUnitDto } from './dto/update-organizational-unit.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUserType } from '../../../modules/auth/types/current-user.type';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Organizational Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'organizational-units', version: '1' })
export class OrganizationalUnitsController {
  constructor(private service: OrganizationalUnitsService) {}

  @Post()
  @Permissions('organizational-unit:create')
  @ApiOperation({ summary: 'Create an organizational unit in the active operational context' })
  create(@Body() dto: CreateOrganizationalUnitDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, user, ctx);
  }

  @Get()
  @Permissions('organizational-unit:read')
  @ApiOperation({ summary: 'List organizational units scoped to the active context' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    type?: string; status?: string; parentId?: string;
  }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      type: query.type,
      status: query.status,
      parentId: query.parentId,
    }, ctx);
  }

  @Get('tree')
  @Permissions('organizational-unit:read')
  @ApiOperation({ summary: 'Get the organizational unit tree for the active context' })
  getTree(@Query('branchId') branchId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getTree(branchId, ctx);
  }

  @Get(':id')
  @Permissions('organizational-unit:read')
  @ApiOperation({ summary: 'Get an organizational unit by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('organizational-unit:update')
  @ApiOperation({ summary: 'Update an organizational unit (tenant-scoped)' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationalUnitDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, user, ctx);
  }

  @Delete(':id')
  @Permissions('organizational-unit:delete')
  @ApiOperation({ summary: 'Soft delete an organizational unit (blocked when children exist)' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, user, ctx);
  }
}
