import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(80)
  appId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

