import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RunnerJobRequest, RunnerJobResult } from './types.js';
import { resolveInside } from './path-scope.js';
import { buildAgentPrompt, buildCliCommand } from './cli-command.js';
import { runProcess } from './process-runner.js';
import { loadApprovedSkills } from './skills.js';
import { renderMarkdownToPdf } from './pdf-report.js';
import { translateWorkspacePath } from './workspace-paths.js';

export async function runAgentJob(request: RunnerJobRequest): Promise<RunnerJobResult> {
  const workspacePath = translateWorkspacePath(request.workspacePath);
  const sessionPath = translateWorkspacePath(request.sessionPath);
  await mkdir(sessionPath, { recursive: true });

  const approvedSkills = await loadApprovedSkills(request.appPolicy.requiredSkills.map((skill) => skill.name));
  await persistApprovedSkills(sessionPath, approvedSkills);

  const outputsRootRelativePath = path.posix.join('sessions', request.sessionId, 'outputs');
  const markdownRelativePath = path.posix.join(outputsRootRelativePath, `research-${request.jobId}.md`);
  const pdfRelativePath = path.posix.join(outputsRootRelativePath, `research-${request.jobId}.pdf`);
  const hostMarkdownAbsolutePath = resolveInside(workspacePath, markdownRelativePath);
  const hostPdfAbsolutePath = resolveInside(workspacePath, pdfRelativePath);
  const promptPath = path.join(sessionPath, `prompt-${request.jobId}.md`);
  const cliOutputPath = path.join(sessionPath, `cli-output-${request.jobId}.md`);
  const prompt = buildAgentPrompt({
    ...request,
    workspacePath,
    sessionPath,
    approvedSkills
  });

  await mkdir(path.dirname(hostMarkdownAbsolutePath), { recursive: true });
  await writeFile(promptPath, prompt, 'utf8');

  const cliCommand = buildCliCommand(request.provider, workspacePath, promptPath, cliOutputPath);
  const result = await runProcess(cliCommand.command, cliCommand.args, {
    cwd: workspacePath,
    stdin: prompt,
    timeoutMs: Number(process.env.RUNNER_JOB_TIMEOUT_MS ?? 300000)
  });

  let finalOutput = result.stdout.trim();
  if (request.provider === 'codex') {
    finalOutput = await readOutputFile(cliOutputPath, finalOutput);
  }
  if (!finalOutput) {
    finalOutput = result.stderr.trim();
  }

  await writeFile(hostMarkdownAbsolutePath, finalOutput, 'utf8');
  await renderMarkdownToPdf(finalOutput, hostPdfAbsolutePath, `${request.appName} Report`);

  return {
    status: result.exitCode === 0 ? 'completed' : 'failed',
    logs: buildJobLogs(
      request.jobId,
      request.provider,
      sessionPath,
      result.exitCode,
      result.stderr,
      markdownRelativePath,
      pdfRelativePath
    ),
    artifacts: [
      {
        path: markdownRelativePath,
        label: 'Research report',
        mimeType: 'text/markdown'
      },
      {
        path: pdfRelativePath,
        label: 'Research PDF',
        mimeType: 'application/pdf'
      }
    ],
    error: result.exitCode === 0 ? undefined : result.stderr || `CLI exited with ${result.exitCode}.`
  };
}

async function persistApprovedSkills(sessionPath: string, skills: Awaited<ReturnType<typeof loadApprovedSkills>>): Promise<void> {
  const skillsRoot = path.join(sessionPath, 'approved-skills');
  await mkdir(skillsRoot, { recursive: true });

  for (const skill of skills) {
    const skillPath = path.join(skillsRoot, `${skill.name}.md`);
    await writeFile(skillPath, skill.content, 'utf8');
  }
}

function buildJobLogs(
  jobId: string,
  provider: string,
  sessionPath: string,
  exitCode: number | null,
  stderr: string,
  markdownRelativePath: string,
  pdfRelativePath: string
): string[] {
  const logs = [
    `Accepted job ${jobId}.`,
    `Prepared session path ${sessionPath}.`,
    `Ran ${provider} CLI in workspace-write mode.`,
    `Exit code: ${exitCode ?? 'unknown'}.`
  ];

  if (exitCode !== 0) {
    logs.push(...summarizeFailureStderr(stderr));
  }

  logs.push(`Wrote ${markdownRelativePath}.`);
  logs.push(`Wrote ${pdfRelativePath}.`);
  return logs;
}

function summarizeFailureStderr(stderr: string): string[] {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-30);

  if (lines.length === 0) {
    return [];
  }

  return ['CLI stderr tail:', ...lines.map((line) => `stderr: ${truncate(line, 500)}`)];
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

async function readOutputFile(filePath: string, fallback: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}
