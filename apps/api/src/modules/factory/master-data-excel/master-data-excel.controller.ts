import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ExcelUpload } from '../../../common/excel/excel-parser';
import { EXCEL_LIMITS, IMPORT_MODES, ExcelImportMode } from '../../../common/excel/excel.types';
import { MasterDataExcelService } from './master-data-excel.service';

export class ExcelQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) locale: 'ar' | 'en' = 'ar';
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
export class ExcelValidateDto {
  @IsIn(IMPORT_MODES) mode: ExcelImportMode = 'CREATE_ONLY';
  @IsOptional() @IsIn(['ar', 'en']) locale: 'ar' | 'en' = 'ar';
}
export class ExcelImportDto extends ExcelValidateDto { @IsUUID('4') token!: string; }
const upload = () => FileInterceptor('file', { limits: { fileSize: EXCEL_LIMITS.fileBytes, files: 1, fields: 4, parts: 5, fieldSize: 200 } });
@Controller({ path: 'master-data-excel/:entity', version: '1' })
@UseGuards(JwtAuthGuard)
export class MasterDataExcelController {
  constructor(private readonly service: MasterDataExcelService) {}
  private send(res: Response, buffer: Buffer, entity: string, kind: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}-${kind}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store'); res.send(buffer);
  }
  @Get('template')
  async template(@Param('entity') entity: string, @Query() query: ExcelQueryDto, @CurrentUser('sub') user: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    this.send(res, await this.service.template(entity, user, ctx, query.locale), entity, 'template');
  }
  @Get('export')
  async export(@Param('entity') entity: string, @Query() query: ExcelQueryDto, @CurrentUser('sub') user: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    this.send(res, await this.service.export(entity, user, ctx, query.locale, query.search), entity, 'export');
  }
  @Post('validate') @UseInterceptors(upload())
  validate(@Param('entity') entity: string, @Body() dto: ExcelValidateDto, @UploadedFile() file: ExcelUpload, @CurrentUser('sub') user: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.validate(entity, file, dto.mode, user, ctx);
  }
  @Post('import') @UseInterceptors(upload())
  import(@Param('entity') entity: string, @Body() dto: ExcelImportDto, @UploadedFile() file: ExcelUpload, @CurrentUser('sub') user: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.import(entity, file, dto.mode, dto.token, user, ctx);
  }
  @Post('errors') @UseInterceptors(upload())
  async errors(@Param('entity') entity: string, @Body() dto: ExcelValidateDto, @UploadedFile() file: ExcelUpload, @CurrentUser('sub') user: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    this.send(res, await this.service.errors(entity, file, dto.mode, user, ctx, dto.locale), entity, 'errors');
  }
}
