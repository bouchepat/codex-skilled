import { BadRequestException } from '@nestjs/common';
import path from 'node:path';
import { normalizeWorkspaceRelativePath, resolveWorkspacePath } from './path-scope';

describe('workspace path scope', () => {
  it('resolves relative paths inside the workspace root', () => {
    const root = path.resolve('/tmp/workspace');

    expect(resolveWorkspacePath(root, 'notes/report.md')).toBe(path.resolve(root, 'notes/report.md'));
  });

  it('rejects traversal outside the workspace root', () => {
    expect(() => resolveWorkspacePath('/tmp/workspace', '../secrets.txt')).toThrow(BadRequestException);
  });

  it('normalizes windows separators into workspace-relative paths', () => {
    expect(normalizeWorkspaceRelativePath('research\\brief.md')).toBe('research/brief.md');
  });
});

