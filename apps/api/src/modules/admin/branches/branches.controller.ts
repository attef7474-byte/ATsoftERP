import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  @Permissions('branches:create')
  @ApiOperation({ summary: 'Create a branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List branches' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string }) {
    return this.branchesService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
    });
  }

  @Get(':id')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'Get branch by ID' })
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('branches:update')
  @ApiOperation({ summary: 'Update branch' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('branches:delete')
  @ApiOperation({ summary: 'Soft delete branch' })
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
