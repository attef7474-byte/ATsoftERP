import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignUserRolesDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
