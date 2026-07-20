import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipantsDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  participantUserIds: string[];
}
