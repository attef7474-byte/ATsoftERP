import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import { ProductionOrderActionDto, ProductionOrderReasonActionDto } from './dto/production-order-action.dto';

@ApiTags('production-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/orders')
export class ProductionOrdersController {
  constructor(private readonly service: ProductionOrdersService) {}

  @Post()
  @Permissions('production-order:create')
  @ApiOperation({ summary: 'Create an idempotent draft production order' })
  create(@Body() dto: CreateProductionOrderDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-order:read')
  findAll(@Query() query: ProductionOrderQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Post('preview')
  @Permissions('production-order:readiness')
  @ApiOperation({ summary: 'Validate references and preview the capacity snapshot and planned duration' })
  preview(@Body() dto: CreateProductionOrderDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.preview(dto, ctx);
  }

  @Get(':id/readiness')
  @Permissions('production-order:readiness')
  readiness(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.readiness(id, ctx);
  }

  @Get(':id/history')
  @Permissions('production-order:read')
  history(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.history(id, ctx);
  }

  @Get(':id/attachments')
  @Permissions('production-order:read')
  attachments(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listAttachments(id, ctx);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permissions('production-order:read')
  async downloadAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    const link = await this.service.getOwnedAttachment(id, attachmentId, ctx);
    return res.download(link.filePath, link.attachment.originalName);
  }

  @Get(':id')
  @Permissions('production-order:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-order:update')
  update(@Param('id') id: string, @Body() dto: UpdateProductionOrderDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('production-order:delete')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  @Post(':id/recalculate')
  @Permissions('production-order:recalculate')
  recalculate(@Param('id') id: string, @Body() dto: ProductionOrderActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recalculate(id, dto, userId, ctx);
  }

  @Post(':id/plan')
  @Permissions('production-order:plan')
  plan(@Param('id') id: string, @Body() dto: ProductionOrderActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.plan(id, dto, userId, ctx);
  }

  @Post(':id/release')
  @Permissions('production-order:release')
  release(@Param('id') id: string, @Body() dto: ProductionOrderActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.release(id, dto, userId, ctx);
  }

  @Post(':id/cancel')
  @Permissions('production-order:cancel')
  cancel(@Param('id') id: string, @Body() dto: ProductionOrderReasonActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Post(':id/archive')
  @Permissions('production-order:archive')
  archive(@Param('id') id: string, @Body() dto: ProductionOrderReasonActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.archive(id, dto, userId, ctx);
  }

  @Post(':id/attachments')
  @Permissions('production-order:attach')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body('description') description: string | undefined, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addAttachment(id, file, description, userId, ctx);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permissions('production-order:attach')
  removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeAttachment(id, attachmentId, userId, ctx);
  }
}
