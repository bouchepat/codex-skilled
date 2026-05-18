import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { Request, Response } from 'express';
import { JobsService } from './jobs.service';
import { JobStreamService } from './job-stream.service';

@Controller('jobs')
@UseGuards(FirebaseAuthGuard)
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly jobStreams: JobStreamService
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId') workspaceId?: string) {
    return this.jobs.list(user.id, workspaceId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobs.enqueue(user.id, dto.sessionId, dto.provider, dto.prompt, dto.inputFiles ?? []);
  }

  @Get(':jobId/stream')
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const job = await this.jobs.getOwnedJob(user.id, jobId);

    response.status(200);
    response.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('cache-control', 'no-cache, no-transform');
    response.setHeader('connection', 'keep-alive');
    response.flushHeaders?.();

    response.write(`${JSON.stringify({ type: 'snapshot', job })}\n`);
    const unsubscribe = this.jobStreams.subscribe(jobId, (event) => {
      response.write(`${JSON.stringify(event)}\n`);
    });

    request.on('close', () => {
      unsubscribe();
      response.end();
    });
  }
}
