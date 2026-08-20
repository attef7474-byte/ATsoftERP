import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { CreateSupervisorAssignmentDto } from './dto/create-supervisor-assignment.dto';
import { UpdateSupervisorAssignmentDto } from './dto/update-supervisor-assignment.dto';
import { ReportingLineQueryDto } from './dto/reporting-line-query.dto';
import { BulkSupervisorAssignmentDto } from './dto/bulk-supervisor-assignment.dto';
import { CandidateQueryDto } from './dto/candidate-query.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Supervisor Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'supervisor-assignments', version: '1' })
export class SupervisorAssignmentsController {
  constructor(private supervisorAssignmentsService: SupervisorAssignmentsService) {}

  @Post()
  @Permissions('supervisor:assign')
  @ApiOperation({ summary: 'Create a supervisor assignment' })
  create(
    @Body() dto: CreateSupervisorAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.supervisorAssignmentsService.create(dto, ctx, userId);
  }

  @Get()
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'List supervisor assignments' })
  findAll(
    @Query() query: { page?: string; limit?: string; search?: string; assignmentId?: string; isActive?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.supervisorAssignmentsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      assignmentId: query.assignmentId,
      isActive: query.isActive,
    }, ctx);
  }

  @Get('reporting-line/:assignmentId')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Get reporting line for an assignment' })
  getReportingLine(
    @Param('assignmentId') assignmentId: string,
    @Query() query: ReportingLineQueryDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    const asOf = query.asOf ? new Date(query.asOf) : undefined;
    return this.supervisorAssignmentsService.getReportingLine(assignmentId, ctx, asOf);
  }

  @Get('subordinates/:assignmentId')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Get subordinates for an assignment' })
  getSubordinates(
    @Param('assignmentId') assignmentId: string,
    @Query() query: ReportingLineQueryDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    const asOf = query.asOf ? new Date(query.asOf) : undefined;
    return this.supervisorAssignmentsService.getSubordinates(assignmentId, ctx, asOf);
  }

  @Get('team/:supervisorAssignmentId')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Get current DIRECT team for a supervisor' })
  getCurrentTeam(
    @Param('supervisorAssignmentId') supervisorAssignmentId: string,
    @Query() query: TeamQueryDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    const asOf = query.asOf ? new Date(query.asOf) : undefined;
    return this.supervisorAssignmentsService.getCurrentTeam(supervisorAssignmentId, ctx, asOf);
  }

  @Get('candidates')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Discover potential team members with eligibility status' })
  getCandidates(
    @Query('supervisorAssignmentId') supervisorAssignmentId: string,
    @Query() query: CandidateQueryDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.supervisorAssignmentsService.getCandidates(supervisorAssignmentId, query, ctx);
  }

  @Post('bulk/preview')
  @Permissions('supervisor:assign')
  @ApiOperation({ summary: 'Preview bulk assignment validation without writing' })
  bulkPreview(
    @Body() dto: BulkSupervisorAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.supervisorAssignmentsService.bulkPreview(dto, ctx);
  }

  @Post('bulk')
  @Permissions('supervisor:assign')
  @ApiOperation({ summary: 'Atomically create bulk DIRECT supervisor assignments' })
  bulkApply(
    @Body() dto: BulkSupervisorAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.supervisorAssignmentsService.bulkApply(dto, ctx, userId);
  }

  @Get(':id')
  @Permissions('supervisor:read')
  @ApiOperation({ summary: 'Get supervisor assignment by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.supervisorAssignmentsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('supervisor:assign')
  @ApiOperation({ summary: 'Update supervisor assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupervisorAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.supervisorAssignmentsService.update(id, dto, ctx, userId);
  }

  @Delete(':id')
  @Permissions('supervisor:remove')
  @ApiOperation({ summary: 'Remove supervisor assignment' })
  remove(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.supervisorAssignmentsService.remove(id, ctx, userId);
  }
}
