import path from 'node:path';

function splitConfiguredPaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

export function buildRunnerPath(): string {
  const configuredDirs = uniquePaths([
    ...splitConfiguredPaths(process.env.RUNNER_CLI_BIN_DIR),
    ...splitConfiguredPaths(process.env.RUNNER_CLI_BIN_DIRS)
  ]);
  const existingPath = splitConfiguredPaths(process.env.PATH);
  return uniquePaths([...configuredDirs, ...existingPath]).join(path.delimiter);
}

export function applyRunnerRuntimeEnv(): void {
  process.env.PATH = buildRunnerPath();
}

export function buildRunnerSpawnEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: buildRunnerPath()
  };
}
