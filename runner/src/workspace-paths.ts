import path from 'node:path';

export function translateWorkspacePath(containerPath: string): string {
  const containerRoot = normalizeSlashes(process.env.CONTAINER_WORKSPACE_ROOT ?? '/workspace-data');
  const hostRoot = process.env.HOST_WORKSPACE_ROOT;
  const normalizedPath = normalizeSlashes(containerPath);

  if (!hostRoot) {
    return containerPath;
  }

  if (normalizedPath === containerRoot) {
    return hostRoot;
  }

  if (!normalizedPath.startsWith(`${containerRoot}/`)) {
    throw new Error(`Workspace path is outside ${containerRoot}.`);
  }

  const relative = normalizedPath.slice(containerRoot.length + 1);
  return path.join(hostRoot, ...relative.split('/'));
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

