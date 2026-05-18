import { CliCommand } from './cli-command.js';

const CONTAINER_WORKSPACE_PATH = '/workspace';

export interface ContainerExecutionPaths {
  workspacePath: string;
  sessionPath: string;
  promptPath: string;
  outputPath: string;
}

export function shouldUseAgentContainer(): boolean {
  return process.env.RUNNER_USE_AGENT_CONTAINERS === 'true';
}

export function buildContainerExecutionPaths(provider: string, sessionId: string, jobId: string): ContainerExecutionPaths {
  const sessionPath = `${CONTAINER_WORKSPACE_PATH}/${provider}/${sessionId}`;
  return {
    workspacePath: CONTAINER_WORKSPACE_PATH,
    sessionPath,
    promptPath: `${sessionPath}/prompt-${jobId}.md`,
    outputPath: `${sessionPath}/cli-output-${jobId}.md`
  };
}

export function wrapInAgentContainer(provider: 'codex' | 'claude', hostWorkspacePath: string, containerCwd: string, command: CliCommand): CliCommand {
  const image = process.env[`RUNNER_${provider.toUpperCase()}_IMAGE`] ?? `codex-skilled/market-research-${provider}:local`;
  const cliMount = process.env.RUNNER_AGENT_CLI_HOST_BIN_DIR;
  const volumes = ['--mount', buildBindMount(hostWorkspacePath, CONTAINER_WORKSPACE_PATH)];
  if (cliMount) {
    volumes.push('--mount', buildBindMount(cliMount, '/opt/agent-cli/bin', true));
  }
  const authMount = getProviderAuthMount(provider);
  if (authMount) {
    volumes.push('--mount', authMount);
  }

  return {
    command: 'docker',
    args: [
      'run',
      '--rm',
      '-i',
      ...volumes,
      ...buildProviderEnvArgs(provider),
      '-e',
      'PATH=/opt/agent-cli/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '-w',
      containerCwd,
      image,
      command.command,
      ...command.args
    ]
  };
}

function getProviderAuthMount(provider: 'codex' | 'claude'): string | undefined {
  if (provider === 'codex' && process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR) {
    return buildBindMount(process.env.RUNNER_AGENT_CODEX_HOME_HOST_DIR, '/root/.codex');
  }

  if (provider === 'claude' && process.env.RUNNER_AGENT_CLAUDE_HOME_HOST_DIR) {
    return buildBindMount(process.env.RUNNER_AGENT_CLAUDE_HOME_HOST_DIR, '/root/.claude');
  }

  return undefined;
}

function buildProviderEnvArgs(provider: 'codex' | 'claude'): string[] {
  const names = provider === 'codex'
    ? ['OPENAI_API_KEY', 'TAVILY_API_KEY']
    : ['ANTHROPIC_API_KEY', 'TAVILY_API_KEY'];
  return names.filter((name) => process.env[name]).flatMap((name) => ['-e', name]);
}

function buildBindMount(source: string, target: string, readonly = false): string {
  const options = [`type=bind`, `source=${source}`, `target=${target}`];
  if (readonly) {
    options.push('readonly');
  }
  return options.join(',');
}
