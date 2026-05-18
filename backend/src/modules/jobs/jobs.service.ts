import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { AGENT_QUEUE } from './jobs.constants';
import { AppExecutionPolicy } from '../apps/app-policy';

const JOB_LIST_LIMIT = 200;
const JOB_LIST_SELECT = {
  id: true,
  userId: true,
  sessionId: true,
  iterationId: true,
  provider: true,
  status: true,
  prompt: true,
  error: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  artifacts: { include: { file: true } }
} as const;

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
        sessionPath: path.join(session.workspace.rootPath, provider, sessionId),
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

  async list(userId: string, workspaceId?: string) {
    if (workspaceId) {
      const sessions = await this.prisma.session.findMany({
        where: { userId, workspaceId },
        select: { id: true }
      });
      const sessionIds = sessions.map((session) => session.id);
      if (sessionIds.length === 0) {
        return [];
      }

      const jobs = await this.prisma.agentJob.findMany({
        where: { userId, sessionId: { in: sessionIds } },
        select: JOB_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: JOB_LIST_LIMIT
      });
      return jobs.map((job) => ({ ...job, logs: [] }));
    }

    const jobs = await this.prisma.agentJob.findMany({
      where: { userId },
      select: JOB_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: JOB_LIST_LIMIT
    });
    return jobs.map((job) => ({ ...job, logs: [] }));
  }

  async getOwnedJob(userId: string, jobId: string) {
    const job = await this.prisma.agentJob.findFirst({
      where: { id: jobId, userId },
      include: { artifacts: { include: { file: true } } }
    });
    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }
}
