import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** First-time provisioning only. Identity and tenancy are server-derived. */
export class EnablePersonLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  password: string;
}
