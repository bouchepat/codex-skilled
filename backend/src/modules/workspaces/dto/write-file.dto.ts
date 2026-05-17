import { IsString, MaxLength } from 'class-validator';

export class WriteFileDto {
  @IsString()
  @MaxLength(500)
  path!: string;

  @IsString()
  content!: string;
}

