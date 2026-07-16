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

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Permissions('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'List all users' })
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @ApiOperation({ summary: 'Soft delete user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/roles')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Assign roles to user' })
  assignRoles(@Param('id') id: string, @Body() dto: AssignUserRolesDto, @CurrentUser('id') userId: string) {
    return this.usersService.assignRoles(id, dto.roleIds, userId);
  }
}
