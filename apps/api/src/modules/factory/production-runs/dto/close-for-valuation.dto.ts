import { IsOptional, IsUUID } from 'class-validator';

export class CloseForValuationDto {
  @IsOptional() @IsUUID() requestId?: string;
}
