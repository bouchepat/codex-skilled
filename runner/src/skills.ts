import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ApprovedSkill {
  name: string;
  content: string;
  path: string;
}

export async function loadApprovedSkills(skillNames: string[] = []): Promise<ApprovedSkill[]> {
  const root = resolveSkillsRoot();
  const uniqueSkillNames = skillNames.length ? [...new Set(skillNames.filter(Boolean))] : await listAvailableSkillNames(root);

  const skills: ApprovedSkill[] = [];
  for (const name of uniqueSkillNames) {
    const skillPath = path.join(root, name, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8').catch(() => {
      throw new Error(`Required skill file not found: ${skillPath}`);
    });
    skills.push({ name, content, path: skillPath });
  }

  return skills;
}

async function listAvailableSkillNames(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const availableNames: string[] = [];

  for (const name of names) {
    const skillPath = path.join(root, name, 'SKILL.md');
    const markerStats = await stat(skillPath).catch(() => undefined);
    if (markerStats?.isFile()) {
      availableNames.push(name);
    }
  }

  return availableNames;
}

function resolveSkillsRoot(): string {
  if (process.env.RUNNER_SKILLS_ROOT) {
    return process.env.RUNNER_SKILLS_ROOT;
  }
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '..', 'skills');
}
