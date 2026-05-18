import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadApprovedSkills } from './skills.js';

test('loadApprovedSkills without names loads every baked skill', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codex-skilled-load-skills-'));
  const skillsRoot = path.join(tempRoot, 'skills');

  await mkdir(path.join(skillsRoot, 'alpha'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'alpha', 'SKILL.md'), '# alpha\n', 'utf8');
  await mkdir(path.join(skillsRoot, 'beta'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'beta', 'SKILL.md'), '# beta\n', 'utf8');
  await mkdir(path.join(skillsRoot, 'ignored'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'ignored', 'README.md'), '# ignored\n', 'utf8');

  const original = process.env.RUNNER_SKILLS_ROOT;
  process.env.RUNNER_SKILLS_ROOT = skillsRoot;

  try {
    const skills = await loadApprovedSkills();

    assert.deepEqual(
      skills.map((skill) => skill.name),
      ['alpha', 'beta']
    );
  } finally {
    if (original === undefined) {
      delete process.env.RUNNER_SKILLS_ROOT;
    } else {
      process.env.RUNNER_SKILLS_ROOT = original;
    }
  }
});
