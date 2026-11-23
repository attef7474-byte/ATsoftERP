import { PartialType } from '@nestjs/swagger';
import { CreatePerformanceProfileMappingDto } from './create-performance-profile-mapping.dto';

export class UpdatePerformanceProfileMappingDto extends PartialType(CreatePerformanceProfileMappingDto) {}
