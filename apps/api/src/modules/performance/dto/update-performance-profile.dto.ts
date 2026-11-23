import { PartialType } from '@nestjs/swagger';
import { CreatePerformanceProfileDto } from './create-performance-profile.dto';

export class UpdatePerformanceProfileDto extends PartialType(CreatePerformanceProfileDto) {}
