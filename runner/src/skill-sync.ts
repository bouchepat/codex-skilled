import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SyncSkillsOptions {
  sourceRoots?: string[];
  destinationRoot?: string;
}

export async function syncSkills(options: SyncSkillsOptions = {}): Promise<string[]> {
  const sourceRoots = (options.sourceRoots ?? resolveDefaultSourceRoots()).filter(Boolean);
  const destinationRoot = options.destinationRoot ?? resolveDefaultDestinationRoot();

  await mkdir(destinationRoot, { recursive: true });

  const copiedSkills = new Set<string>();
  for (const sourceRoot of sourceRoots) {
    const sourceStats = await stat(sourceRoot).catch(() => undefined);
    if (!sourceStats?.isDirectory()) {
      continue;
    }

    const entries = await readdir(sourceRoot, { withFileTypes: true });
    const skillNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

    for (const skillName of skillNames) {
      const sourceSkillPath = path.join(sourceRoot, skillName);
      const skillMarker = path.join(sourceSkillPath, 'SKILL.md');
      const markerStats = await stat(skillMarker).catch(() => undefined);
      if (!markerStats?.isFile()) {
        continue;
      }

      const destinationSkillPath = path.join(destinationRoot, skillName);
      await rm(destinationSkillPath, { recursive: true, force: true });
      await cp(sourceSkillPath, destinationSkillPath, { recursive: true });
      copiedSkills.add(skillName);
    }
  }

  return [...copiedSkills].sort();
}

export async function runSkillSyncCli(): Promise<void> {
  const copied = await syncSkills();
  console.log(`Synced ${copied.length} skill(s): ${copied.join(', ') || 'none'}.`);
}

function resolveDefaultSourceRoots(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(moduleDir, '..', '..');
  return [
    path.resolve(repoRoot, '.codex', 'skills'),
    path.resolve(repoRoot, '.agents', 'skills')
  ];
}

function resolveDefaultDestinationRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '..', 'skills');
}

const isDirectRun = (() => {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }
  return path.resolve(entryPoint) === fileURLToPath(import.meta.url);
})();

if (isDirectRun) {
  runSkillSyncCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
