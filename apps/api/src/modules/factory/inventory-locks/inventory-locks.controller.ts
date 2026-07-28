import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { InventoryLocksService } from './inventory-locks.service'
import { CreateInventoryLockDto } from './dto/create-lock.dto'
import { UpdateInventoryLockDto } from './dto/update-lock.dto'
import { LockQueryDto, LockCheckDto } from './dto/lock-query.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/guards/permissions.guard'
import { Permissions } from '../../auth/decorators/permissions.decorator'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'

@ApiTags('Inventory Locks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/locks', version: '1' })
export class InventoryLocksController {
  constructor(private service: InventoryLocksService) {}

  @Post()
  @Permissions('inventory:lock:create')
  @ApiOperation({ summary: 'Create inventory lock' })
  create(@Body() dto: CreateInventoryLockDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId)
  }

  @Get()
  @Permissions('inventory:lock:read')
  @ApiOperation({ summary: 'List inventory locks' })
  findAll(@Query() query: LockQueryDto) {
    return this.service.findAll(query)
  }

  @Get(':id')
  @Permissions('inventory:lock:read')
  @ApiOperation({ summary: 'Get inventory lock by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  @Permissions('inventory:lock:update')
  @ApiOperation({ summary: 'Update inventory lock' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryLockDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId)
  }

  @Post(':id/activate')
  @Permissions('inventory:lock:activate')
  @ApiOperation({ summary: 'Activate inventory lock' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.activate(id, userId)
  }

  @Post(':id/deactivate')
  @Permissions('inventory:lock:deactivate')
  @ApiOperation({ summary: 'Deactivate inventory lock' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.deactivate(id, userId)
  }

  @Delete(':id')
  @Permissions('inventory:lock:delete')
  @ApiOperation({ summary: 'Delete inventory lock' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId)
  }

  @Post('check')
  @Permissions('inventory:lock:read')
  @ApiOperation({ summary: 'Check if a lock applies for given date/warehouse/location/product' })
  check(@Body() dto: LockCheckDto) {
    return this.service.checkLock(dto)
  }
}
