import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { AGENT_QUEUE } from './jobs.constants';
import { AppExecutionPolicy } from '../apps/app-policy';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    @InjectQueue(AGENT_QUEUE) private readonly queue: Queue
  ) {}

  async enqueue(userId: string, sessionId: string, provider: string, prompt: string, inputFiles: string[] = []) {
    const session = await this.sessions.getOwnedSession(userId, sessionId);
    const policy = session.app?.policy as unknown as AppExecutionPolicy | undefined;
    if (!policy) {
      throw new BadRequestException('App policy is missing.');
    }
    if (!policy.allowedProviders.includes(provider as 'codex' | 'claude')) {
      throw new BadRequestException(`Provider ${provider} is not allowed for this app.`);
    }
    const nextVersion = session.iterations.length + 1;
    const iteration = await this.prisma.sessionIteration.create({
      data: {
        sessionId,
        version: nextVersion,
        prompt,
        inputRefs: inputFiles,
        outputRefs: []
      }
    });
    const job = await this.prisma.agentJob.create({
      data: {
        userId,
        sessionId,
        iterationId: iteration.id,
        provider,
        prompt,
        status: JobStatus.QUEUED,
        logs: []
      }
    });

    await this.queue.add(
      'run-agent',
      {
        jobId: job.id,
        userId,
        sessionId,
        iterationId: iteration.id,
        provider,
        prompt,
        inputFiles,
        workspacePath: session.workspace.rootPath,
        sessionPath: path.join(session.workspace.rootPath, 'sessions', sessionId),
        appId: session.appId,
        appName: session.app.name,
        appPolicy: policy
      },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    return job;
  }

  async list(userId: string) {
    return this.prisma.agentJob.findMany({
      where: { userId },
      include: { artifacts: { include: { file: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }
}
