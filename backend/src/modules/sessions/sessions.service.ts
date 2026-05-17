import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
}
