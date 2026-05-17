import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsString()
  prompt!: string;

  @IsIn(['codex', 'claude'])
  provider!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inputFiles?: string[];
}

