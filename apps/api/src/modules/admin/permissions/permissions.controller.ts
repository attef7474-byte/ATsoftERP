import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'List all permissions' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; module?: string }) {
    return this.permissionsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      module: query.module,
    });
  }

  @Get('modules')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get distinct permission modules' })
  getModules() {
    return this.permissionsService.getModules();
  }

  @Get('grouped')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permissions grouped by module' })
  getGrouped(@Query('roleId') roleId?: string) {
    return this.permissionsService.getGrouped(roleId);
  }

  @Get('matrix')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permission-role assignment matrix' })
  getMatrix() {
    return this.permissionsService.getMatrix();
  }

  @Get(':id')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permission by ID' })
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }
}
