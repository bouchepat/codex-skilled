import { IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MaxLength(80)
  appId!: string;

  @IsString()
  @MaxLength(120)
  workspaceId!: string;

  @IsString()
  @MaxLength(160)
  title!: string;
}

