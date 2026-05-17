import { Processor, WorkerHost } from '@nestjs/bullmq';
import { FileKind, JobStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { mkdir, stat } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerService } from '../runner/runner.service';
import { RunnerJobResult } from '../runner/runner.types';
import { normalizeWorkspaceRelativePath, resolveWorkspacePath } from '../workspaces/path-scope';
import { AGENT_QUEUE } from './jobs.constants';

interface AgentQueuePayload {
  jobId: string;
  userId: string;
  sessionId: string;
  iterationId: string;
  appId: string;
  appName: string;
  provider: string;
  prompt: string;
  inputFiles: string[];
  workspacePath: string;
  sessionPath: string;
  appPolicy: {
    allowedProviders: Array<'codex' | 'claude'>;
    requiredSkills: Array<{ name: string; required: boolean }>;
    requiredArtifacts: Array<{ label: string; mimeType: string; extension: string }>;
    resumeSessions: boolean;
  };
}

@Processor(AGENT_QUEUE, { concurrency: 3 })
export class JobsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: RunnerService
  ) {
    super();
  }

  async process(job: Job<AgentQueuePayload>): Promise<void> {
    const payload = job.data;
    await mkdir(payload.sessionPath, { recursive: true });
    await this.prisma.agentJob.update({
      where: { id: payload.jobId },
      data: { status: JobStatus.RUNNING, startedAt: new Date() }
    });

    try {
      const result = await this.runner.run(payload);
      await this.persistResult(payload, result);
    } catch (error) {
      await this.prisma.agentJob.update({
        where: { id: payload.jobId },
        data: {
          status: JobStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date()
        }
      });
      throw error;
    }
  }

  private async persistResult(payload: AgentQueuePayload, result: RunnerJobResult): Promise<void> {
    const status = result.status === 'completed' ? JobStatus.COMPLETED : JobStatus.FAILED;
    const outputRefs: string[] = [];
    const session = await this.prisma.session.findUniqueOrThrow({ where: { id: payload.sessionId } });

    for (const artifact of result.artifacts) {
      const relativePath = normalizeWorkspaceRelativePath(artifact.path);
      const absolutePath = resolveWorkspacePath(payload.workspacePath, relativePath);
      const fileStats = await stat(absolutePath);
      const file = await this.prisma.workspaceFile.upsert({
        where: { workspaceId_path: { workspaceId: session.workspaceId, path: relativePath } },
        create: {
          workspaceId: session.workspaceId,
          path: relativePath,
          kind: FileKind.GENERATED,
          mimeType: artifact.mimeType,
          sizeBytes: fileStats.size
        },
        update: {
          mimeType: artifact.mimeType,
          sizeBytes: fileStats.size
        }
      });
      await this.prisma.artifact.create({
        data: { jobId: payload.jobId, fileId: file.id, label: artifact.label }
      });
      outputRefs.push(relativePath);
    }

    await this.prisma.sessionIteration.update({
      where: { id: payload.iterationId },
      data: { outputRefs }
    });
    await this.prisma.agentJob.update({
      where: { id: payload.jobId },
      data: {
        status,
        logs: result.logs,
        error: result.error,
        finishedAt: new Date()
      }
    });
    await this.prisma.session.update({
      where: { id: payload.sessionId },
      data: { status }
    });
  }
}
