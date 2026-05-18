import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppStatus, FileKind, Workspace } from '@prisma/client';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeWorkspaceRelativePath, resolveWorkspacePath } from './path-scope';
import { buildWorkspaceRootPath } from './workspace-root';

@Injectable()
export class WorkspacesService {
  private readonly workspaceRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.workspaceRoot = this.config.get<string>('WORKSPACE_ROOT') ?? path.resolve(process.cwd(), '..', 'workspace-data');
  }

  async listForUser(userId: string): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      where: { userId },
      include: { app: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(userId: string, appId: string, name = 'Default'): Promise<Workspace> {
    const app = await this.prisma.appDefinition.findUniqueOrThrow({ where: { id: appId } });
    if (app.status !== AppStatus.ENABLED) {
      throw new ForbiddenException('This app is not available yet.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rootPath = buildWorkspaceRootPath(this.workspaceRoot, user.email, appId, name);
    await mkdir(rootPath, { recursive: true });
    return this.prisma.workspace.upsert({
      where: { userId_appId_name: { userId, appId, name } },
      create: { userId, appId, name, rootPath },
      update: { rootPath }
    });
  }

  async getOwnedWorkspace(userId: string, workspaceId: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }
    if (workspace.userId !== userId) {
      throw new ForbiddenException('Workspace does not belong to this user.');
    }
    return workspace;
  }

  async writeTextFile(userId: string, workspaceId: string, filePath: string, content: string) {
    const workspace = await this.getOwnedWorkspace(userId, workspaceId);
    const relativePath = normalizeWorkspaceRelativePath(filePath);
    const absolutePath = resolveWorkspacePath(workspace.rootPath, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
    const fileStats = await stat(absolutePath);

    return this.prisma.workspaceFile.upsert({
      where: { workspaceId_path: { workspaceId, path: relativePath } },
      create: {
        workspaceId,
        path: relativePath,
        kind: FileKind.EDITABLE,
        mimeType: 'text/plain',
        sizeBytes: fileStats.size
      },
      update: {
        mimeType: 'text/plain',
        sizeBytes: fileStats.size
      }
    });
  }

  async readTextFile(userId: string, workspaceId: string, filePath: string): Promise<string> {
    const workspace = await this.getOwnedWorkspace(userId, workspaceId);
    const relativePath = normalizeWorkspaceRelativePath(filePath);
    const absolutePath = resolveWorkspacePath(workspace.rootPath, relativePath);
    try {
      return await readFile(absolutePath, 'utf8');
    } catch {
      throw new NotFoundException('Workspace file content not found on disk.');
    }
  }

  async saveUpload(userId: string, workspaceId: string, destinationPath: string, file: Express.Multer.File) {
    const workspace = await this.getOwnedWorkspace(userId, workspaceId);
    const relativePath = normalizeWorkspaceRelativePath(destinationPath);
    const absolutePath = resolveWorkspacePath(workspace.rootPath, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);
    const fileStats = await stat(absolutePath);

    return this.prisma.workspaceFile.upsert({
      where: { workspaceId_path: { workspaceId, path: relativePath } },
      create: {
        workspaceId,
        path: relativePath,
        kind: FileKind.UPLOAD,
        mimeType: file.mimetype,
        sizeBytes: fileStats.size
      },
      update: {
        mimeType: file.mimetype,
        sizeBytes: fileStats.size
      }
    });
  }

  async getDownload(userId: string, workspaceId: string, filePath: string) {
    const workspace = await this.getOwnedWorkspace(userId, workspaceId);
    const relativePath = normalizeWorkspaceRelativePath(filePath);
    const absolutePath = resolveWorkspacePath(workspace.rootPath, relativePath);
    const file = await this.prisma.workspaceFile.findUnique({
      where: { workspaceId_path: { workspaceId, path: relativePath } }
    });
    if (!file) {
      throw new NotFoundException('Workspace file not found.');
    }
    return { absolutePath, file };
  }

  async listFiles(userId: string, workspaceId: string) {
    await this.getOwnedWorkspace(userId, workspaceId);
    return this.prisma.workspaceFile.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
