import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BootstrapFirstBranchDto } from './dto/bootstrap-first-branch.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUserType } from '../../../modules/auth/types/current-user.type';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { OperationalContextOptional } from '../../../common/operational-context/operational-context-optional.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  @Permissions('branches:create')
  @ApiOperation({ summary: 'Create a branch' })
  create(@Body() dto: CreateBranchDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.branchesService.create(dto, ctx);
  }

  @Post('bootstrap')
  @Permissions('branches:create')
  @OperationalContextOptional()
  @ApiOperation({
    summary:
      'Create the first branch of a company that has none (SUPER_ADMIN system administration only)',
    description:
      'A company with zero branches cannot have an active operational context, so the normal context-bound branch creation path is unreachable for it. This route resolves authority from the database, requires an ACTIVE target company with zero non-deleted branches, and creates exactly one branch owned by the submitted company. It never trusts a client company for the normal path and never mutates user scopes.',
  })
  bootstrapFirstBranch(
    @Body() dto: BootstrapFirstBranchDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.branchesService.bootstrapFirstBranch(dto, user.id);
  }

  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List branches' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.branchesService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
    }, ctx);
  }

  @Get(':id')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'Get branch by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.branchesService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('branches:update')
  @ApiOperation({ summary: 'Update branch' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.branchesService.update(id, dto, ctx, user.id);
  }

  @Delete(':id')
  @Permissions('branches:delete')
  @ApiOperation({ summary: 'Soft delete branch' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.branchesService.remove(id, ctx);
  }
}
