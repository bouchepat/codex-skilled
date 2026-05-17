import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ApprovedSkill {
  name: string;
  content: string;
  path: string;
}

export async function loadApprovedSkills(skillNames: string[]): Promise<ApprovedSkill[]> {
  const root = resolveSkillsRoot();
  const uniqueSkillNames = [...new Set(skillNames.filter(Boolean))];

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

function resolveSkillsRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '..', 'skills');
}
