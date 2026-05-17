import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { buildRunnerPath } from './runtime-env.js';

describe('runtime env', () => {
  const originalPath = process.env.PATH;
  const originalBinDir = process.env.RUNNER_CLI_BIN_DIR;
  const originalBinDirs = process.env.RUNNER_CLI_BIN_DIRS;

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }

    if (originalBinDir === undefined) {
      delete process.env.RUNNER_CLI_BIN_DIR;
    } else {
      process.env.RUNNER_CLI_BIN_DIR = originalBinDir;
    }

    if (originalBinDirs === undefined) {
      delete process.env.RUNNER_CLI_BIN_DIRS;
    } else {
      process.env.RUNNER_CLI_BIN_DIRS = originalBinDirs;
    }
  });

  it('prefers configured runner cli directories ahead of the existing path', () => {
    process.env.RUNNER_CLI_BIN_DIR = '/opt/codex/bin';
    process.env.RUNNER_CLI_BIN_DIRS = `/opt/claude/bin${process.platform === 'win32' ? ';' : ':'}/opt/shared/bin`;
    process.env.PATH = '/usr/local/bin';

    const built = buildRunnerPath();

    assert.ok(built.startsWith(`/opt/codex/bin${process.platform === 'win32' ? ';' : ':'}`));
    assert.ok(built.includes('/opt/claude/bin'));
    assert.ok(built.includes('/opt/shared/bin'));
    assert.ok(built.endsWith('/usr/local/bin'));
  });
});
