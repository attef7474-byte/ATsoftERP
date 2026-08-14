import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../modules/auth/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Permissions('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() dto: CreateUserDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.create(dto, ctx);
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'List all users' })
  findAll(@Query() query: UsersQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.update(id, dto, ctx);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @ApiOperation({ summary: 'Soft delete user' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.remove(id, ctx);
  }

  @Post(':id/roles')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Assign roles to user' })
  assignRoles(@Param('id') id: string, @Body() dto: AssignUserRolesDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.usersService.assignRoles(id, dto.roleIds, userId, ctx);
  }
}
