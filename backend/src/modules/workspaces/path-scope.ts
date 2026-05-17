import { BadRequestException } from '@nestjs/common';
import path from 'node:path';

export function resolveWorkspacePath(rootPath: string, requestedPath: string): string {
  const normalizedRequest = requestedPath.replace(/\\/g, '/');
  if (path.isAbsolute(normalizedRequest)) {
    throw new BadRequestException('Absolute paths are not allowed.');
  }

  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, normalizedRequest);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new BadRequestException('Path escapes workspace root.');
  }

  return resolvedTarget;
}

export function normalizeWorkspaceRelativePath(requestedPath: string): string {
  const normalized = requestedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) {
    throw new BadRequestException('Invalid workspace path.');
  }
  return path.posix.normalize(normalized);
}

