import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RunnerJobRequest, RunnerJobResult } from './types.js';
import { resolveInside } from './path-scope.js';
import { buildAgentPrompt, buildCliCommand } from './cli-command.js';
import { runProcess } from './process-runner.js';
import { loadApprovedSkills } from './skills.js';
import { renderMarkdownToPdf } from './pdf-report.js';
import { translateWorkspacePath } from './workspace-paths.js';
import { buildContainerExecutionPaths, shouldUseAgentContainer, wrapInAgentContainer } from './container-command.js';

export async function runAgentJob(
  request: RunnerJobRequest,
  handlers: { onLogLine?: (line: string) => void } = {}
): Promise<RunnerJobResult> {
  if (shouldUseAgentContainer() && !process.env.HOST_WORKSPACE_ROOT) {
    throw new Error(
      'RUNNER_USE_AGENT_CONTAINERS=true requires HOST_WORKSPACE_ROOT to point to the host workspace-data directory, for example E:\\Repositories\\codex-skilled\\workspace-data.'
    );
  }

  const workspacePath = translateWorkspacePath(request.workspacePath);
  const sessionPath = translateWorkspacePath(request.sessionPath);
  await mkdir(sessionPath, { recursive: true });

  const approvedSkills = await loadApprovedSkills();
  await persistApprovedSkills(sessionPath, approvedSkills);

  const logs: string[] = [];
  const emitLog = (line: string): void => {
    logs.push(line);
    handlers.onLogLine?.(line);
  };

  const outputsRootPath = path.join(sessionPath, 'outputs');
  const outputsRootRelativePath = toWorkspaceRelativePath(workspacePath, outputsRootPath);
  const reportBaseName = `${new Date().toISOString().slice(0, 10)}-${slugifyReportName(request.prompt)}`;
  let markdownRelativePath = path.posix.join(outputsRootRelativePath, `${reportBaseName}.md`);
  let pdfRelativePath = path.posix.join(outputsRootRelativePath, `${reportBaseName}.pdf`);
  let hostMarkdownAbsolutePath = resolveInside(workspacePath, markdownRelativePath);
  let hostPdfAbsolutePath = resolveInside(workspacePath, pdfRelativePath);
  const promptPath = path.join(sessionPath, `prompt-${request.jobId}.md`);
  const cliOutputPath = path.join(sessionPath, `cli-output-${request.jobId}.md`);
  const executionPaths = shouldUseAgentContainer()
    ? buildContainerExecutionPaths(request.provider, request.sessionId, request.jobId)
    : {
        workspacePath,
        sessionPath,
        promptPath,
        outputPath: cliOutputPath
      };
  const promptWorkspacePath = shouldUseAgentContainer() ? executionPaths.workspacePath : workspacePath;
  const promptSessionPath = shouldUseAgentContainer() ? executionPaths.sessionPath : sessionPath;
  const prompt = buildAgentPrompt({
    ...request,
    workspacePath: promptWorkspacePath,
    sessionPath: promptSessionPath,
    approvedSkills
  });

  await mkdir(outputsRootPath, { recursive: true });
  await writeFile(promptPath, prompt, 'utf8');
  emitLog(`Accepted job ${request.jobId}.`);
  emitLog(`Prepared session path ${sessionPath}.`);
  emitLog(
    `Running ${request.provider} CLI in ${shouldUseAgentContainer() ? 'nested agent container' : 'workspace-write mode'}.`
  );

  let cliCommand = buildCliCommand(request.provider, executionPaths.sessionPath, executionPaths.promptPath, executionPaths.outputPath);
  if (shouldUseAgentContainer()) {
    cliCommand = wrapInAgentContainer(request.provider, workspacePath, executionPaths.sessionPath, cliCommand);
  }
  let result: { exitCode: number | null; stdout: string; stderr: string };
  let executionError: Error | undefined;
  try {
    result = await runProcess(cliCommand.command, cliCommand.args, {
      cwd: sessionPath,
      stdin: prompt,
      timeoutMs: Number(process.env.RUNNER_JOB_TIMEOUT_MS ?? 300000),
      onStdoutLine: emitLog,
      onStderrLine: emitLog
    });
    emitLog(`Exit code: ${result.exitCode ?? 'unknown'}.`);
  } catch (error) {
    executionError = error instanceof Error ? error : new Error(String(error));
    emitLog(executionError.message);
    result = {
      exitCode: null,
      stdout: '',
      stderr: executionError.message
    };
  }

  let finalOutput = result.stdout.trim();
  if (request.provider === 'codex') {
    finalOutput = await readOutputFile(cliOutputPath, finalOutput);
  }
  if (!finalOutput) {
    finalOutput = result.stderr.trim();
  }

  const generatedMarkdown = await findBestGeneratedMarkdown(outputsRootPath);
  if (generatedMarkdown) {
    markdownRelativePath = toWorkspaceRelativePath(workspacePath, generatedMarkdown);
    hostMarkdownAbsolutePath = generatedMarkdown;
    finalOutput = await coerceMarkdownOutput(await readFile(generatedMarkdown, 'utf8'));
    finalOutput = await appendAutoVisuals(finalOutput, path.dirname(generatedMarkdown));
    await writeFile(hostMarkdownAbsolutePath, finalOutput, 'utf8');
    const matchingPdf = replaceExtension(generatedMarkdown, '.pdf');
    try {
      await stat(matchingPdf);
      pdfRelativePath = toWorkspaceRelativePath(workspacePath, matchingPdf);
      hostPdfAbsolutePath = matchingPdf;
    } catch {
      pdfRelativePath = replaceExtension(markdownRelativePath, '.pdf');
      hostPdfAbsolutePath = resolveInside(workspacePath, pdfRelativePath);
      await renderMarkdownToPdf(finalOutput, hostPdfAbsolutePath, `${request.appName} Report`, path.dirname(generatedMarkdown));
    }
  } else {
    finalOutput = await coerceMarkdownOutput(finalOutput);
    finalOutput = await appendAutoVisuals(finalOutput, path.dirname(hostMarkdownAbsolutePath));
    await writeFile(hostMarkdownAbsolutePath, finalOutput, 'utf8');
    await renderMarkdownToPdf(finalOutput, hostPdfAbsolutePath, `${request.appName} Report`, path.dirname(hostMarkdownAbsolutePath));
  }

  await cleanupSessionArtifacts(sessionPath, outputsRootPath, [hostMarkdownAbsolutePath, hostPdfAbsolutePath]);
  emitLog(`Wrote ${markdownRelativePath}.`);
  emitLog(`Wrote ${pdfRelativePath}.`);
  emitLog('Cleaned session artifacts.');

  return {
    status: result.exitCode === 0 && !executionError ? 'completed' : 'failed',
    logs,
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
    error:
      executionError?.message ??
      (result.exitCode === 0 ? undefined : result.stderr || `CLI exited with ${result.exitCode}.`)
  };
}

async function findBestGeneratedMarkdown(outputsPath: string): Promise<string | undefined> {
  try {
    const entries = await readdir(outputsPath, { withFileTypes: true });
    const markdownFiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
        .map(async (entry) => {
          const filePath = path.join(outputsPath, entry.name);
          const fileStats = await stat(filePath);
          return { filePath, size: fileStats.size, mtimeMs: fileStats.mtimeMs };
        })
    );
    return markdownFiles
      .filter((file) => file.size > 0)
      .sort((left, right) => right.size - left.size || right.mtimeMs - left.mtimeMs)[0]?.filePath;
  } catch {
    return undefined;
  }
}

function replaceExtension(filePath: string, extension: string): string {
  return `${filePath.slice(0, -path.extname(filePath).length)}${extension}`;
}

function toWorkspaceRelativePath(workspacePath: string, absolutePath: string): string {
  const relativePath = path.relative(workspacePath, absolutePath);
  return relativePath.split(path.sep).join(path.posix.sep);
}

function slugifyReportName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'research-report';
}

async function persistApprovedSkills(sessionPath: string, skills: Awaited<ReturnType<typeof loadApprovedSkills>>): Promise<void> {
  const skillsRoot = path.join(sessionPath, 'approved-skills');
  await mkdir(skillsRoot, { recursive: true });

  for (const skill of skills) {
    const skillPath = path.join(skillsRoot, `${skill.name}.md`);
    await writeFile(skillPath, skill.content, 'utf8');
  }
}

async function readOutputFile(filePath: string, fallback: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

async function coerceMarkdownOutput(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return decodeReadableText(content);
  }

  try {
    const parsed = JSON.parse(trimmed) as { content?: unknown };
    if (typeof parsed.content === 'string' && parsed.content.trim()) {
      return decodeReadableText(parsed.content.trim());
    }
  } catch {
    return decodeReadableText(content);
  }

  return decodeReadableText(content);
}

function decodeReadableText(value: string): string {
  const original = value.trimEnd();
  const decoded = Buffer.from(original, 'latin1').toString('utf8');
  return scoreMojibake(decoded) < scoreMojibake(original) ? decoded : original;
}

function scoreMojibake(value: string): number {
  return ['â€', 'Ã', 'Â', '�'].reduce((score, fragment) => score + (value.includes(fragment) ? 1 : 0), 0);
}

async function appendAutoVisuals(markdown: string, reportDir: string): Promise<string> {
  if (hasMarkdownImageReferences(markdown)) {
    return markdown;
  }

  const visuals = await collectAutoVisuals(reportDir);
  if (!visuals.length) {
    return markdown;
  }

  const lines = [markdown.trimEnd(), '', '## Visuals'];
  for (const visual of visuals) {
    lines.push('');
    lines.push(`### ${visual.title}`);
    lines.push(`![${visual.altText}](${visual.relativePath})`);
    lines.push('');
    lines.push(visual.caption);
  }
  return lines.join('\n');
}

function hasMarkdownImageReferences(markdown: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)/.test(markdown);
}

async function collectAutoVisuals(reportDir: string): Promise<Array<{ title: string; altText: string; relativePath: string; caption: string }>> {
  const visuals: Array<{ title: string; altText: string; relativePath: string; caption: string }> = [];

  const assetsDir = path.join(reportDir, 'assets');
  const assetEntries = await readdir(assetsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of assetEntries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) {
      continue;
    }
    const relativePath = path.posix.join('assets', entry.name);
    visuals.push({
      title: prettifyAssetTitle(entry.name),
      altText: prettifyAssetTitle(entry.name),
      relativePath,
      caption: `Source note: Local image asset stored at \`${relativePath}\`.`
    });
  }

  const chartHtmlDir = path.join(reportDir, 'chart-html');
  const chartEntries = await readdir(chartHtmlDir, { withFileTypes: true }).catch(() => []);
  for (const entry of chartEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const screenshotPath = path.join(chartHtmlDir, entry.name, 'screenshot.png');
    const screenshotStats = await stat(screenshotPath).catch(() => undefined);
    if (!screenshotStats?.isFile()) {
      continue;
    }
    const relativePath = path.posix.join('chart-html', entry.name, 'screenshot.png');
    visuals.push({
      title: prettifyAssetTitle(entry.name),
      altText: prettifyAssetTitle(entry.name),
      relativePath,
      caption: `Source note: Chart screenshot stored at \`${relativePath}\`.`
    });
  }

  return visuals;
}

function prettifyAssetTitle(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export async function cleanupSessionArtifacts(sessionPath: string, outputsRootPath: string, keepPaths: string[]): Promise<void> {
  const normalizedKeepPaths = new Set(keepPaths.map(normalizePath));

  const sessionEntries = await readdir(sessionPath, { withFileTypes: true }).catch(() => []);
  for (const entry of sessionEntries) {
    const entryPath = path.join(sessionPath, entry.name);
    if (normalizePath(entryPath) === normalizePath(outputsRootPath)) {
      continue;
    }
    await rm(entryPath, { recursive: true, force: true }).catch(() => undefined);
  }

  const outputEntries = await readdir(outputsRootPath, { withFileTypes: true }).catch(() => []);
  for (const entry of outputEntries) {
    const entryPath = path.join(outputsRootPath, entry.name);
    if (normalizedKeepPaths.has(normalizePath(entryPath))) {
      continue;
    }
    await rm(entryPath, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizePath(value: string): string {
  return path.resolve(value).toLowerCase();
}
