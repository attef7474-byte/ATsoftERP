import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMachineDocumentDto {
  @ApiProperty()
  @IsString()
  machineId: string;

  @ApiProperty({ example: 'Maintenance Manual' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'manual' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'https://storage.example.com/doc.pdf' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
