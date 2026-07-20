import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UploadedFile, UseInterceptors, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { AttachmentsService } from './attachments.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import * as path from 'path'

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  @Permissions('attachments.view')
  @ApiOperation({ summary: 'List attachments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'mimeType', required: false })
  async findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('entityType') entityType?: string, @Query('mimeType') mimeType?: string) {
    return this.service.findAll(Number(page) || 1, Number(pageSize) || 20, entityType, mimeType)
  }

  @Get(':id')
  @Permissions('attachments.view')
  @ApiOperation({ summary: 'Get attachment metadata' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Get(':id/download')
  @Permissions('attachments.download')
  @ApiOperation({ summary: 'Download attachment file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.service.findOne(id)
    const filePath = this.service.getFilePath(attachment)
    const safePath = path.resolve(filePath)
    const uploadRoot = path.resolve(this.service['uploadRoot'])
    if (!safePath.startsWith(uploadRoot)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    res.download(safePath, attachment.originalName)
  }

  @Post()
  @Permissions('attachments.create')
  @ApiOperation({ summary: 'Upload attachment' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(@UploadedFile() file: Express.Multer.File, @Body('entityName') entityName: string, @Body('entityId') entityId: string, @Body('description') description: string, @CurrentUser('id') userId: string) {
    return this.service.create(file, entityName, entityId, description, userId)
  }

  @Patch(':id')
  @Permissions('attachments.update')
  @ApiOperation({ summary: 'Update attachment metadata' })
  async update(@Param('id') id: string, @Body() dto: { entityName?: string; entityId?: string; description?: string }) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @Permissions('attachments.delete')
  @ApiOperation({ summary: 'Delete attachment' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Get('entities/:entityType/:entityId')
  @Permissions('attachments.view')
  @ApiOperation({ summary: 'Get attachments by entity' })
  async findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.findByEntity(entityType, entityId)
  }
}
