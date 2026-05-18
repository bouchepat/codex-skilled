import { spawn } from 'node:child_process';
import { buildRunnerSpawnEnv } from './runtime-env.js';

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  cwd: string;
  stdin: string;
  timeoutMs: number;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export function runProcess(command: string, args: string[], options: RunProcessOptions): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: process.platform === 'win32',
      env: buildRunnerSpawnEnv()
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${options.timeoutMs}ms.`));
    }, options.timeoutMs);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
      stdoutBuffer = consumeLines(stdoutBuffer + chunk.toString('utf8'), options.onStdoutLine);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk);
      stderrBuffer = consumeLines(stderrBuffer + chunk.toString('utf8'), options.onStderrLine);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      flushLine(stdoutBuffer, options.onStdoutLine);
      flushLine(stderrBuffer, options.onStderrLine);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      });
    });

    child.stdin.end(options.stdin);
  });
}

function consumeLines(buffer: string, onLine?: (line: string) => void): string {
  const segments = buffer.split(/\r?\n/);
  const remainder = segments.pop() ?? '';
  for (const line of segments) {
    if (line.trim()) {
      onLine?.(line);
    }
  }
  return remainder;
}

function flushLine(buffer: string, onLine?: (line: string) => void): void {
  const line = buffer.trim();
  if (line) {
    onLine?.(line);
  }
}
