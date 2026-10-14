import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetMachineLinksDto {
  @ApiProperty({ type: [String], description: 'Full desired set of machine ids for this spare part' })
  @IsArray()
  @IsString({ each: true })
  machineIds: string[];
}
