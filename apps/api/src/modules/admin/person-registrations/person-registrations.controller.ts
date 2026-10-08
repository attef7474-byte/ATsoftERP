import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PersonRegistrationsService } from './person-registrations.service';
import { CreatePersonRegistrationDto } from './dto/create-person-registration.dto';
import { UpdatePersonRegistrationDto } from './dto/update-person-registration.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/**
 * Canonical person registration surface.
 *
 * `operational-person:create|read|update` guards the person itself. The optional login and
 * maintenance capability are separately permission-gated inside the service against
 * `user:create|update` and `maintenance-personnel:create|update`, because one route cannot
 * express a key set that depends on the request body, and a single umbrella key would let
 * a person-only operator mint logins.
 */
@ApiTags('person-registrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'person-registrations', version: '1' })
export class PersonRegistrationsController {
  constructor(private personRegistrationsService: PersonRegistrationsService) {}

  @Post()
  @Permissions('operational-person:create')
  @ApiOperation({
    summary:
      'Register a person once: identity, placement, and optionally a system login and maintenance capability, in one transaction',
  })
  create(
    @Body() dto: CreatePersonRegistrationDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.personRegistrationsService.create(dto, ctx, actorUserId);
  }

  @Get()
  @Permissions('operational-person:read')
  @ApiOperation({ summary: 'List people registered in the active branch with their login and capability state' })
  findAll(
    @Query() query: { page?: string; limit?: string; search?: string; isActive?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.personRegistrationsService.findAll(
      {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        search: query.search,
        isActive: query.isActive,
      },
      ctx,
    );
  }

  @Get(':id')
  @Permissions('operational-person:read')
  @ApiOperation({ summary: 'Get one registered person with placement, login and capability' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.personRegistrationsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('operational-person:update')
  @ApiOperation({
    summary:
      'Update a person and its linked login/capability in one transaction, preserving authentication state, roles and placement history',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonRegistrationDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.personRegistrationsService.update(id, dto, ctx, actorUserId);
  }
}