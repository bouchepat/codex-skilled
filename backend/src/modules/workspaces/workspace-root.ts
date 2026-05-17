import path from 'node:path';

export function slugifyEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/^mailto:/, '')
    .replace(/@/g, '-at-')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function buildWorkspaceRootPath(baseRoot: string, email: string, appId: string, name: string): string {
  return path.join(baseRoot, slugifyEmail(email), appId, slugifyWorkspaceName(name));
}

export function slugifyWorkspaceName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-]+|[-]+$/g, '') || 'default';
}
