import { PartialType } from '@nestjs/swagger';
import { CreateDowntimeLogDto } from './create-downtime-log.dto';

export class UpdateDowntimeLogDto extends PartialType(CreateDowntimeLogDto) {}
