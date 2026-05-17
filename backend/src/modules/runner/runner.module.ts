import { Module } from '@nestjs/common';
import { RunnerService } from './runner.service';

@Module({
  providers: [RunnerService],
  exports: [RunnerService]
})
export class RunnerModule {}

