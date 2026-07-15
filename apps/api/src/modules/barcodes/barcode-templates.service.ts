import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateBarcodeTemplateDto } from './dto/create-barcode-template.dto';
import { UpdateBarcodeTemplateDto } from './dto/update-barcode-template.dto';

@Injectable()
export class BarcodeTemplatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateBarcodeTemplateDto, userId: string) {
    const template = await this.prisma.barcodeLabelTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        symbology: dto.symbology || 'QR_CODE',
        entityType: dto.entityType,
        templateData: dto.templateData,
        status: 'ACTIVE',
      },
    });
    await this.audit.log(userId, 'CREATE', 'BarcodeLabelTemplate', template.id, { code: template.code, name: template.name });
    return template;
  }

  async findAll() {
    const data = await this.prisma.barcodeLabelTemplate.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    return { data };
  }

  async findOne(id: string) {
    const template = await this.prisma.barcodeLabelTemplate.findUnique({ where: { id } });
    if (!template || template.deletedAt) throw new NotFoundException('Barcode template not found');
    return template;
  }

  async update(id: string, dto: UpdateBarcodeTemplateDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.barcodeLabelTemplate.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'BarcodeLabelTemplate', id, { dto });
    return updated;
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.barcodeLabelTemplate.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'BarcodeLabelTemplate', id);
    return updated;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.barcodeLabelTemplate.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'BarcodeLabelTemplate', id);
    return updated;
  }
}
