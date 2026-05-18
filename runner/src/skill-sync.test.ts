import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { syncSkills } from './skill-sync.js';

test('syncSkills merges source roots into the destination without removing existing local skills', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codex-skilled-skill-sync-'));
  const sourceCodex = path.join(tempRoot, '.codex', 'skills');
  const sourceAgents = path.join(tempRoot, '.agents', 'skills');
  const destination = path.join(tempRoot, 'runner', 'skills');

  await mkdir(path.join(sourceCodex, 'market-research'), { recursive: true });
  await writeFile(path.join(sourceCodex, 'market-research', 'SKILL.md'), '# marketplace market-research\n', 'utf8');
  await mkdir(path.join(sourceAgents, 'browser-use'), { recursive: true });
  await writeFile(path.join(sourceAgents, 'browser-use', 'SKILL.md'), '# browser-use\n', 'utf8');
  await mkdir(path.join(destination, 'pdf'), { recursive: true });
  await writeFile(path.join(destination, 'pdf', 'SKILL.md'), '# pdf local\n', 'utf8');

  const copied = await syncSkills({
    sourceRoots: [sourceCodex, sourceAgents],
    destinationRoot: destination
  });

  assert.deepEqual(copied, ['browser-use', 'market-research']);
  assert.equal(await readFile(path.join(destination, 'market-research', 'SKILL.md'), 'utf8'), '# marketplace market-research\n');
  assert.equal(await readFile(path.join(destination, 'browser-use', 'SKILL.md'), 'utf8'), '# browser-use\n');
  assert.equal(await readFile(path.join(destination, 'pdf', 'SKILL.md'), 'utf8'), '# pdf local\n');
});
