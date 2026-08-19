import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JobTitlesService } from './job-titles.service';
import { CreateJobTitleDto } from './dto/create-job-title.dto';
import { UpdateJobTitleDto } from './dto/update-job-title.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Job Titles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'job-titles', version: '1' })
export class JobTitlesController {
  constructor(private jobTitlesService: JobTitlesService) {}

  @Post()
  @Permissions('job-title:create')
  @ApiOperation({ summary: 'Create a job title' })
  create(
    @Body() dto: CreateJobTitleDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobTitlesService.create(dto, ctx, userId);
  }

  @Get()
  @Permissions('job-title:read')
  @ApiOperation({ summary: 'List job titles' })
  findAll(
    @Query() query: { page?: string; limit?: string; search?: string; category?: string; isActive?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.jobTitlesService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      category: query.category,
      isActive: query.isActive,
    }, ctx);
  }

  @Get(':id')
  @Permissions('job-title:read')
  @ApiOperation({ summary: 'Get job title by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.jobTitlesService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('job-title:update')
  @ApiOperation({ summary: 'Update job title' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobTitleDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobTitlesService.update(id, dto, ctx, userId);
  }

  @Delete(':id')
  @Permissions('job-title:delete')
  @ApiOperation({ summary: 'Soft delete job title' })
  remove(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobTitlesService.remove(id, ctx, userId);
  }
}
