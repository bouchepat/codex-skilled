import path from 'node:path';

export function resolveInside(rootPath: string, requestedPath: string): string {
  if (path.isAbsolute(requestedPath)) {
    throw new Error('Absolute paths are not allowed.');
  }
  const root = path.resolve(rootPath);
  const target = path.resolve(root, requestedPath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace root.');
  }
  return target;
}

