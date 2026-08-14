import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { MachineDocumentsService } from './machine-documents.service';
import { CreateMachineDocumentDto } from './dto/create-machine-document.dto';
import { UpdateMachineDocumentDto } from './dto/update-machine-document.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Machine Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-documents', version: '1' })
export class MachineDocumentsController {
  constructor(private service: MachineDocumentsService) {}

  @Post()
  @Permissions('machine-document:create')
  @ApiOperation({ summary: 'Create machine document' })
  create(@Body() dto: CreateMachineDocumentDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'List machine documents' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; machineId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
    }, ctx);
  }

  @Get('history')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get document history' })
  getHistory(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getHistory({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('by-machine/:machineId')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get documents by machine' })
  getByMachine(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDocumentsByMachine(machineId, ctx);
  }

  @Get(':id')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get machine document by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('machine-document:update')
  @ApiOperation({ summary: 'Update machine document' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineDocumentDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('machine-document:deactivate')
  @ApiOperation({ summary: 'Delete machine document' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('machine-document:deactivate')
  @ApiOperation({ summary: 'Deactivate machine document (not supported)' })
  deactivate() {
    return this.service.deactivate();
  }

  @Get(':id/view')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'View machine document' })
  view(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.viewDocument(id, ctx); }

  @Get(':id/download')
  @Permissions('machine-document:download')
  @ApiOperation({ summary: 'Download machine document' })
  async download(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    const doc = await this.service.viewDocument(id, ctx);
    return res.redirect(doc.fileUrl);
  }
}
