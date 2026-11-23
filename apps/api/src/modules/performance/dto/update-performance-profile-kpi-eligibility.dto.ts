import { PartialType } from '@nestjs/swagger';
import { CreatePerformanceProfileKpiEligibilityDto } from './create-performance-profile-kpi-eligibility.dto';

export class UpdatePerformanceProfileKpiEligibilityDto extends PartialType(CreatePerformanceProfileKpiEligibilityDto) {}
