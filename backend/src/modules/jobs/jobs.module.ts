import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RunnerModule } from '../runner/runner.module';
import { SessionsModule } from '../sessions/sessions.module';
import { JobsController } from './jobs.controller';
import { JobStreamService } from './job-stream.service';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';
import { AGENT_QUEUE } from './jobs.constants';

@Module({
  imports: [BullModule.registerQueue({ name: AGENT_QUEUE }), SessionsModule, RunnerModule],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor, JobStreamService],
  exports: [JobsService, JobStreamService]
})
export class JobsModule {}
