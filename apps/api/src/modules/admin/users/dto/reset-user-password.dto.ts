import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  confirmNewPassword: string;
}
