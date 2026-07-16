import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceChecklistExecutionsService } from './maintenance-checklist-executions.service';
import { CreateMaintenanceChecklistExecutionDto } from './dto/create-maintenance-checklist-execution.dto';
import { UpdateChecklistExecutionItemDto } from './dto/update-checklist-execution-item.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance Checklist Executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/checklist-executions', version: '1' })
export class MaintenanceChecklistExecutionsController {
  constructor(private service: MaintenanceChecklistExecutionsService) {}

  @Post()
  @Permissions('maintenance-checklist-execution:create')
  @ApiOperation({ summary: 'Start a checklist execution' })
  create(@Body() dto: CreateMaintenanceChecklistExecutionDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-checklist-execution:read')
  @ApiOperation({ summary: 'List checklist executions' })
  findAll(@Query() query: { scheduleId?: string; requestId?: string; status?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('maintenance-checklist-execution:read')
  @ApiOperation({ summary: 'Get checklist execution by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/complete')
  @Permissions('maintenance-checklist-execution:complete')
  @ApiOperation({ summary: 'Complete a checklist execution' })
  complete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.complete(id, userId);
  }

  @Patch(':id/items/:itemId')
  @Permissions('maintenance-checklist-execution:update')
  @ApiOperation({ summary: 'Update a checklist execution item' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistExecutionItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateItem(id, itemId, dto, userId);
  }
}
