import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { translateWorkspacePath } from './workspace-paths.js';

test('translateWorkspacePath maps container workspace paths to host paths', () => {
  process.env.CONTAINER_WORKSPACE_ROOT = '/workspace-data';
  process.env.HOST_WORKSPACE_ROOT = path.resolve('workspace-data');

  assert.equal(
    translateWorkspacePath('/workspace-data/user/app/default'),
    path.join(process.env.HOST_WORKSPACE_ROOT, 'user', 'app', 'default')
  );
});

test('translateWorkspacePath rejects paths outside the container workspace root', () => {
  process.env.CONTAINER_WORKSPACE_ROOT = '/workspace-data';
  process.env.HOST_WORKSPACE_ROOT = path.resolve('workspace-data');

  assert.throws(() => translateWorkspacePath('/etc/passwd'), /outside/);
});

