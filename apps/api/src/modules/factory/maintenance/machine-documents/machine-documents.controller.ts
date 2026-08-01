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

@ApiTags('Machine Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-documents', version: '1' })
export class MachineDocumentsController {
  constructor(private service: MachineDocumentsService) {}

  @Post()
  @Permissions('machine-document:create')
  @ApiOperation({ summary: 'Create machine document' })
  create(@Body() dto: CreateMachineDocumentDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'List machine documents' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; machineId?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
    });
  }

  @Get('history')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get document history' })
  getHistory(@Query() query: { page?: string; limit?: string }) {
    return this.service.getHistory({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('by-machine/:machineId')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get documents by machine' })
  getByMachine(@Param('machineId') machineId: string) {
    return this.service.getDocumentsByMachine(machineId);
  }

  @Get(':id')
  @Permissions('machine-document:read')
  @ApiOperation({ summary: 'Get machine document by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('machine-document:update')
  @ApiOperation({ summary: 'Update machine document' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineDocumentDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('machine-document:deactivate')
  @ApiOperation({ summary: 'Delete machine document' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
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
  view(@Param('id') id: string) { return this.service.viewDocument(id); }

  @Get(':id/download')
  @Permissions('machine-document:download')
  @ApiOperation({ summary: 'Download machine document' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.service.viewDocument(id);
    return res.redirect(doc.fileUrl);
  }
}
