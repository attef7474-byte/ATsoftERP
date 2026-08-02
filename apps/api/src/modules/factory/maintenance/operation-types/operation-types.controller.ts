import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OperationTypesService } from './operation-types.service';
import { CreateOperationTypeDto } from './dto/create-operation-type.dto';
import { UpdateOperationTypeDto } from './dto/update-operation-type.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Operation Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/operation-types', version: '1' })
export class OperationTypesController {
  constructor(private service: OperationTypesService) {}

  @Post()
  @Permissions('operationTypes:create')
  @ApiOperation({ summary: 'Create operation type' })
  create(@Body() dto: CreateOperationTypeDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('operationTypes:read')
  @ApiOperation({ summary: 'List operation types' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('operationTypes:read')
  @ApiOperation({ summary: 'Get operation type by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('operationTypes:update')
  @ApiOperation({ summary: 'Update operation type' })
  update(@Param('id') id: string, @Body() dto: UpdateOperationTypeDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('operationTypes:delete')
  @ApiOperation({ summary: 'Soft delete operation type' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }

  @Patch(':id/activate')
  @Permissions('operationTypes:activate')
  @ApiOperation({ summary: 'Activate operation type' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('operationTypes:deactivate')
  @ApiOperation({ summary: 'Deactivate operation type' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.deactivate(id, userId);
  }
}
