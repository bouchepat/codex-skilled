import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService
  ) {}

  async create(userId: string, appId: string, workspaceId: string, title: string) {
    const workspace = await this.workspaces.getOwnedWorkspace(userId, workspaceId);
    if (workspace.appId !== appId) {
      throw new BadRequestException('Workspace does not belong to the selected app.');
    }
    return this.prisma.session.create({
      data: { userId, appId, workspaceId, title }
    });
  }

  async list(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      include: { app: true, workspace: true, iterations: { orderBy: { version: 'asc' } } },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { app: true, workspace: true, iterations: { orderBy: { version: 'asc' } } }
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Session does not belong to this user.');
    }
    return session;
  }

  async delete(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        workspace: true,
        jobs: {
          include: {
            artifacts: {
              include: { file: true }
            }
          }
        }
      }
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Session does not belong to this user.');
    }

    const artifactFiles = session.jobs.flatMap((job) => job.artifacts.map((artifact) => artifact.file));
    const artifactIds = session.jobs.flatMap((job) => job.artifacts.map((artifact) => artifact.id));
    const artifactFileIds = [...new Set(artifactFiles.map((file) => file.id))];

    await this.prisma.$transaction([
      this.prisma.artifact.deleteMany({ where: { id: { in: artifactIds } } }),
      this.prisma.agentJob.deleteMany({ where: { sessionId } }),
      this.prisma.sessionIteration.deleteMany({ where: { sessionId } }),
      this.prisma.workspaceFile.deleteMany({ where: { id: { in: artifactFileIds } } }),
      this.prisma.session.delete({ where: { id: sessionId } })
    ]);

    await Promise.allSettled(artifactFiles.map((file) => unlink(path.join(session.workspace.rootPath, file.path))));
    await Promise.allSettled([
      rm(path.join(session.workspace.rootPath, 'codex', sessionId), { recursive: true, force: true }),
      rm(path.join(session.workspace.rootPath, 'claude', sessionId), { recursive: true, force: true })
    ]);

    return { deleted: true, sessionId };
  }
}
