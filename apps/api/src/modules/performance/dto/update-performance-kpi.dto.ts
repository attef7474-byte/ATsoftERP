import { PartialType } from '@nestjs/swagger';
import { CreatePerformanceKpiDto } from './create-performance-kpi.dto';

export class UpdatePerformanceKpiDto extends PartialType(CreatePerformanceKpiDto) {}
