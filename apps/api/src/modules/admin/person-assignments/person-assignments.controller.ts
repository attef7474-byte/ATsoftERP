import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PersonAssignmentsService } from './person-assignments.service';
import { CreatePersonAssignmentDto } from './dto/create-person-assignment.dto';
import { UpdatePersonAssignmentDto } from './dto/update-person-assignment.dto';
import { TransferPersonAssignmentDto } from './dto/transfer-person-assignment.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Person Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'person-assignments', version: '1' })
export class PersonAssignmentsController {
  constructor(private personAssignmentsService: PersonAssignmentsService) {}

  @Post()
  @Permissions('person-assignment:create')
  @ApiOperation({ summary: 'Create a person assignment' })
  create(
    @Body() dto: CreatePersonAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.personAssignmentsService.create(dto, ctx, userId);
  }

  @Get()
  @Permissions('person-assignment:read')
  @ApiOperation({ summary: 'List person assignments' })
  findAll(
    @Query() query: { page?: string; limit?: string; search?: string; personnelId?: string; departmentId?: string; branchId?: string; assignmentType?: string; isActive?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.personAssignmentsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      personnelId: query.personnelId,
      departmentId: query.departmentId,
      branchId: query.branchId,
      assignmentType: query.assignmentType,
      isActive: query.isActive,
    }, ctx);
  }

  @Get('person/:personnelId')
  @Permissions('person-assignment:read')
  @ApiOperation({ summary: 'Get assignments by person' })
  findByPerson(@Param('personnelId') personnelId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.personAssignmentsService.findByPerson(personnelId, ctx);
  }

  @Get(':id')
  @Permissions('person-assignment:read')
  @ApiOperation({ summary: 'Get person assignment by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.personAssignmentsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('person-assignment:update')
  @ApiOperation({ summary: 'Update person assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.personAssignmentsService.update(id, dto, ctx, userId);
  }

  @Post(':id/transfer')
  @Permissions('person-assignment:transfer')
  @ApiOperation({ summary: 'Transfer person to new assignment (atomic)' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferPersonAssignmentDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.personAssignmentsService.transfer(id, dto, ctx, userId);
  }

  @Delete(':id')
  @Permissions('person-assignment:update')
  @ApiOperation({ summary: 'Soft delete person assignment' })
  remove(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.personAssignmentsService.remove(id, ctx, userId);
  }
}
