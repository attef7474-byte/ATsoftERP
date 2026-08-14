import { BadRequestException, Controller, ForbiddenException, Get, Post, Patch, Delete, Param, Body, Query, UploadedFile, UseInterceptors, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { AttachmentsService } from './attachments.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import * as path from 'path'
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'

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
  async findAll(@CurrentActiveContext() ctx: ActiveOperationalContext, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('entityType') entityType?: string, @Query('mimeType') mimeType?: string) {
    return this.service.findAll(ctx, Number(page) || 1, Number(pageSize) || 20, entityType, mimeType)
  }

  @Get(':id')
  @Permissions('attachments.view')
  @ApiOperation({ summary: 'Get attachment metadata' })
  async findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    const attachment = await this.service.findOne(id, ctx)
    this.assertGenericAccess(attachment)
    return attachment
  }

  @Get(':id/download')
  @Permissions('attachments.download')
  @ApiOperation({ summary: 'Download attachment file' })
  async download(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    const attachment = await this.service.findOne(id, ctx)
    this.assertGenericAccess(attachment)
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
  async create(@UploadedFile() file: Express.Multer.File, @Body('entityName') entityName: string, @Body('entityId') entityId: string, @Body('description') description: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    if (entityName === 'ProductionOrder') throw new BadRequestException({ messageKey: 'productionOrder.useScopedAttachmentEndpoint' })
    return this.service.create(file, entityName, entityId, description, userId, ctx)
  }

  @Patch(':id')
  @Permissions('attachments.update')
  @ApiOperation({ summary: 'Update attachment metadata' })
  async update(@Param('id') id: string, @Body() dto: { entityName?: string; entityId?: string; description?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    this.assertGenericAccess(await this.service.findOne(id, ctx))
    if (dto.entityName === 'ProductionOrder') throw new BadRequestException({ messageKey: 'productionOrder.useScopedAttachmentEndpoint' })
    return this.service.update(id, dto, ctx)
  }

  @Delete(':id')
  @Permissions('attachments.delete')
  @ApiOperation({ summary: 'Delete attachment' })
  async remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    this.assertGenericAccess(await this.service.findOne(id, ctx))
    return this.service.remove(id, ctx)
  }

  @Get('entities/:entityType/:entityId')
  @Permissions('attachments.view')
  @ApiOperation({ summary: 'Get attachments by entity' })
  async findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findByEntity(entityType, entityId, ctx)
  }

  private assertGenericAccess(attachment: { entityName: string }) {
    if (attachment.entityName === 'ProductionOrder') throw new ForbiddenException({ messageKey: 'productionOrder.useScopedAttachmentEndpoint' })
  }
}
