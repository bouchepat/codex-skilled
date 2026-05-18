import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentPrompt, buildCliCommand } from './cli-command.js';

test('buildCliCommand uses codex exec with workspace-write sandboxing', () => {
  const command = buildCliCommand('codex', '/workspace/user/app/default', '/tmp/prompt.md', '/tmp/result.md');

  assert.equal(command.command, 'codex');
  assert.deepEqual(command.args.slice(0, 2), ['exec', '--cd']);
  assert.ok(command.args.includes('workspace-write'));
  assert.equal(command.args.at(-1), '-');
});

test('buildCliCommand uses danger-full-access for nested agent containers', () => {
  const original = process.env.RUNNER_USE_AGENT_CONTAINERS;
  process.env.RUNNER_USE_AGENT_CONTAINERS = 'true';

  const command = buildCliCommand('codex', '/workspace/user/app/default', '/tmp/prompt.md', '/tmp/result.md');

  assert.ok(command.args.includes('danger-full-access'));
  assert.ok(command.args.includes('--dangerously-bypass-approvals-and-sandbox'));

  if (original === undefined) {
    delete process.env.RUNNER_USE_AGENT_CONTAINERS;
  } else {
    process.env.RUNNER_USE_AGENT_CONTAINERS = original;
  }
});

test('buildCliCommand uses claude print mode', () => {
  const command = buildCliCommand('claude', '/workspace/user/app/default', '/tmp/prompt.md', '/tmp/result.md');

  assert.equal(command.command, 'claude');
  assert.ok(command.args.includes('--print'));
  assert.ok(command.args.includes('--permission-mode'));
  assert.ok(command.args.includes('dontAsk'));
});

test('buildAgentPrompt includes selected input files', () => {
  const prompt = buildAgentPrompt({
    jobId: 'job',
    userId: 'user',
    sessionId: 'session',
    appId: 'market-research',
    appName: 'Market Research',
    workspacePath: '/workspace',
    sessionPath: '/workspace/sessions/session',
    provider: 'codex',
    prompt: 'Research bitcoin',
    inputFiles: ['notes/research.md'],
      appPolicy: {
        allowedProviders: ['codex', 'claude'] as const,
        requiredSkills: [
          { name: 'market-research', required: true },
          { name: 'pdf', required: true },
          { name: 'tavily-research', required: true },
          { name: 'chart', required: false }
        ],
      requiredArtifacts: [
        { label: 'Research report', mimeType: 'text/markdown', extension: 'md' },
        { label: 'Research PDF', mimeType: 'application/pdf', extension: 'pdf' }
      ],
      resumeSessions: true
    },
    approvedSkills: [
      { name: 'market-research', path: '/skills/market-research/SKILL.md', content: '# market-research' },
      { name: 'pdf', path: '/skills/pdf/SKILL.md', content: '# pdf' },
      { name: 'tavily-research', path: '/skills/tavily-research/SKILL.md', content: '# tavily-research' },
      { name: 'chart', path: '/skills/chart/SKILL.md', content: '# chart' }
    ]
  });

  assert.match(prompt, /Research bitcoin/);
  assert.match(prompt, /notes\/research.md/);
  assert.match(prompt, /Approved skills/);
  assert.match(prompt, /Required and optional skills/);
  assert.match(prompt, /tavily-research/);
  assert.match(prompt, /chart/);
  assert.match(prompt, /Report quality contract/);
  assert.match(prompt, /Research PDF/);
});
