import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { wrapInAgentContainer } from './container-command.js';

test('wrapInAgentContainer does not mount the runner host CLI path into nested agent containers', () => {
  const originalCliHostBinDir = process.env.RUNNER_CLI_HOST_BIN_DIR;
  const originalAgentCliHostBinDir = process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  process.env.RUNNER_CLI_HOST_BIN_DIR = 'C:\\Program Files\\nodejs';
  delete process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;

  const wrapped = wrapInAgentContainer(
    'codex',
    'E:\\Repositories\\codex-skilled\\workspace-data\\user\\market-research',
    '/workspace/codex/session-1',
    { command: 'codex', args: ['exec', '-'] }
  );

  assert.equal(wrapped.command, 'docker');
  assert.deepEqual(wrapped.args.slice(0, 8), [
    'run',
    '--rm',
    '-i',
    '--mount',
    'type=bind,source=E:\\Repositories\\codex-skilled\\workspace-data\\user\\market-research,target=/workspace',
    '-e',
    'PATH=/opt/agent-cli/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    '-w'
  ]);

  if (originalCliHostBinDir === undefined) {
    delete process.env.RUNNER_CLI_HOST_BIN_DIR;
  } else {
    process.env.RUNNER_CLI_HOST_BIN_DIR = originalCliHostBinDir;
  }

  if (originalAgentCliHostBinDir === undefined) {
    delete process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  } else {
    process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR = originalAgentCliHostBinDir;
  }
});

test('wrapInAgentContainer can mount an explicit agent CLI path', () => {
  const originalAgentCliHostBinDir = process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR = 'E:\\agent-cli\\linux-bin';

  const wrapped = wrapInAgentContainer(
    'codex',
    'E:\\Repositories\\codex-skilled\\workspace-data\\user\\market-research',
    '/workspace/codex/session-1',
    { command: 'codex', args: ['exec', '-'] }
  );

  assert.deepEqual(wrapped.args.slice(0, 8), [
    'run',
    '--rm',
    '-i',
    '--mount',
    'type=bind,source=E:\\Repositories\\codex-skilled\\workspace-data\\user\\market-research,target=/workspace',
    '--mount',
    'type=bind,source=E:\\agent-cli\\linux-bin,target=/opt/agent-cli/bin,readonly',
    '-e'
  ]);

  if (originalAgentCliHostBinDir === undefined) {
    delete process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  } else {
    process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR = originalAgentCliHostBinDir;
  }
});

test('wrapInAgentContainer can mount provider auth state and pass API key environment', () => {
  const originalCodexHome = process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR = 'C:\\Users\\bouch\\.codex';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.TAVILY_API_KEY = 'tavily-test-key';

  const wrapped = wrapInAgentContainer(
    'codex',
    'E:\\Repositories\\codex-skilled\\workspace-data\\user\\market-research',
    '/workspace/codex/session-1',
    { command: 'codex', args: ['exec', '-'] }
  );

  assert.ok(wrapped.args.includes('type=bind,source=C:\\Users\\bouch\\.codex,target=/root/.codex'));
  const openAiEnvIndex = wrapped.args.findIndex((arg, index) => arg === 'OPENAI_API_KEY' && wrapped.args[index - 1] === '-e');
  assert.notEqual(openAiEnvIndex, -1);
  const tavilyEnvIndex = wrapped.args.findIndex((arg, index) => arg === 'TAVILY_API_KEY' && wrapped.args[index - 1] === '-e');
  assert.notEqual(tavilyEnvIndex, -1);

  if (originalCodexHome === undefined) {
    delete process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR;
  } else {
    process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR = originalCodexHome;
  }

  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  if (originalTavilyKey === undefined) {
    delete process.env.TAVILY_API_KEY;
  } else {
    process.env.TAVILY_API_KEY = originalTavilyKey;
  }
});

afterEach(() => {
  delete process.env.RUNNER_CODEX_IMAGE;
  delete process.env.RUNNER_CLAUDE_IMAGE;
  delete process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  delete process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR;
  delete process.env.RUNNER_AGENT_CLAUDE_HOME_HOST_DIR;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});
