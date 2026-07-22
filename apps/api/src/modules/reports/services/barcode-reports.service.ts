import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BarcodeReportFilterDto } from '../dto/report-filter.dto';
import { buildDateFilter, paginate } from './report-query-utils';

@Injectable()
export class BarcodeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBarcodeScansReport(filters: BarcodeReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'scannedAt') };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.scanPurpose) where.purpose = filters.scanPurpose;
    if (filters.result) where.result = filters.result;
    if (filters.scannedById) where.scannedById = filters.scannedById;

    const [total, rows, successCount, failCount, notFoundCount, byPurpose, byEntity] = await Promise.all([
      this.prisma.barcodeScanEvent.count({ where }),
      this.prisma.barcodeScanEvent.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { scannedAt: 'desc' },
        include: { label: { select: { id: true, code: true } } },
      }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'SUCCESS' } }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'FAIL' } }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'NOT_FOUND' } }),
      this.prisma.barcodeScanEvent.groupBy({ by: ['purpose'], where, _count: true }),
      this.prisma.barcodeScanEvent.groupBy({ by: ['entityType'], where, _count: true }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalScans', value: total },
        { label: 'successfulScans', value: successCount },
        { label: 'failedScans', value: failCount },
        { label: 'notFoundScans', value: notFoundCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byPurpose: byPurpose.map(p => ({ purpose: p.purpose, count: p._count })),
      byEntity: byEntity.map(e => ({ entityType: e.entityType, count: e._count })),
    };
  }
}
