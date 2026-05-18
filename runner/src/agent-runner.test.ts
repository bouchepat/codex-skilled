import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cleanupSessionArtifacts } from './agent-runner.js';

test('cleanupSessionArtifacts keeps only the final markdown and pdf outputs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runner-cleanup-'));
  const sessionPath = path.join(root, 'session');
  const outputsPath = path.join(sessionPath, 'outputs');

  await mkdir(path.join(outputsPath, 'assets'), { recursive: true });
  await mkdir(path.join(outputsPath, 'chart-html', 'chart-1'), { recursive: true });
  await mkdir(path.join(sessionPath, 'approved-skills'), { recursive: true });
  await writeFile(path.join(sessionPath, 'prompt-job.md'), 'prompt', 'utf8');
  await writeFile(path.join(sessionPath, 'cli-output-job.md'), 'cli output', 'utf8');
  await writeFile(path.join(outputsPath, 'report.md'), 'report', 'utf8');
  await writeFile(path.join(outputsPath, 'report.pdf'), 'pdf', 'utf8');
  await writeFile(path.join(outputsPath, 'tmp.json'), '{}', 'utf8');
  await writeFile(path.join(outputsPath, 'assets', 'image.png'), 'image', 'utf8');
  await writeFile(path.join(outputsPath, 'chart-html', 'chart-1', 'screenshot.png'), 'chart', 'utf8');
  await writeFile(path.join(sessionPath, 'approved-skills', 'skill.md'), 'skill', 'utf8');

  await cleanupSessionArtifacts(sessionPath, outputsPath, [path.join(outputsPath, 'report.md'), path.join(outputsPath, 'report.pdf')]);

  const sessionEntries = await readdir(sessionPath);
  assert.deepEqual(sessionEntries, ['outputs']);

  const outputEntries = (await readdir(outputsPath)).sort();
  assert.deepEqual(outputEntries, ['report.md', 'report.pdf']);
});
