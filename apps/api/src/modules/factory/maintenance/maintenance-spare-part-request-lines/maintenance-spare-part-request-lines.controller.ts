import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service';
import { CreateSparePartRequestLineDto, UpdateSparePartRequestLineDto } from './dto/create-spare-part-request-line.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Spare Part Request Lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/requests/:requestId/parts', version: '1' })
export class MaintenanceSparePartRequestLinesController {
  constructor(private service: MaintenanceSparePartRequestLinesService) {}

  @Post()
  @Permissions('maintenance-request-parts:create')
  @ApiOperation({ summary: 'Create spare part request line' })
  create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateSparePartRequestLineDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.create(requestId, dto, userId, ctx);
  }

  @Get()
  @Permissions('maintenance-request-parts:read')
  @ApiOperation({ summary: 'List request part lines' })
  findAll(@Param('requestId') requestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(requestId, ctx);
  }

  @Get(':lineId')
  @Permissions('maintenance-request-parts:read')
  @ApiOperation({ summary: 'Get request part line detail' })
  findOne(@Param('requestId') requestId: string, @Param('lineId') lineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(requestId, lineId, ctx);
  }

  @Patch(':lineId')
  @Permissions('maintenance-request-parts:update')
  @ApiOperation({ summary: 'Update draft part line' })
  update(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateSparePartRequestLineDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.update(requestId, lineId, dto, userId, ctx);
  }

  @Patch(':lineId/request')
  @Permissions('maintenance-request-parts:request')
  @ApiOperation({ summary: 'Submit/request spare part' })
  submit(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.submit(requestId, lineId, userId, ctx);
  }

  @Patch(':lineId/approve')
  @Permissions('maintenance-request-parts:approve')
  @ApiOperation({ summary: 'Approve spare part request' })
  approve(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.approve(requestId, lineId, userId, ctx);
  }

  @Patch(':lineId/reject')
  @Permissions('maintenance-request-parts:reject')
  @ApiOperation({ summary: 'Reject spare part request' })
  reject(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reject(requestId, lineId, userId, ctx);
  }

  @Patch(':lineId/reserve')
  @Permissions('maintenance-request-parts:reserve')
  @ApiOperation({ summary: 'Reserve spare part operationally' })
  reserve(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reserve(requestId, lineId, userId, ctx);
  }

  @Patch(':lineId/use')
  @Permissions('maintenance-request-parts:use')
  @ApiOperation({ summary: 'Mark spare part as used' })
  markUsed(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.markUsed(requestId, lineId, userId, ctx);
  }

  @Patch(':lineId/cancel')
  @Permissions('maintenance-request-parts:cancel')
  @ApiOperation({ summary: 'Cancel spare part request' })
  cancel(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.cancel(requestId, lineId, userId, ctx);
  }
}
