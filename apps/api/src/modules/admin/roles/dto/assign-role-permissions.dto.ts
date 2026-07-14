import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRolePermissionsDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
