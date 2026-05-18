import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunnerJobRequest, RunnerJobResult, RunnerStreamEvent } from './runner.types';

export interface RunnerRunHandlers {
  onLogLine?: (line: string) => void | Promise<void>;
}

@Injectable()
export class RunnerService {
  constructor(private readonly config: ConfigService) {}

  buildRequest(input: RunnerJobRequest): RunnerJobRequest {
    return {
      ...input,
      inputFiles: [...input.inputFiles]
    };
  }

  async run(input: RunnerJobRequest, handlers: RunnerRunHandlers = {}): Promise<RunnerJobResult> {
    const runnerUrl = this.config.get<string>('RUNNER_URL') ?? this.config.get<string>('HOST_RUNNER_URL');
    const sharedSecret = this.config.get<string>('RUNNER_SHARED_SECRET');
    if (!runnerUrl || !sharedSecret) {
      throw new ServiceUnavailableException('Runner is not configured.');
    }

    const response = await fetch(`${runnerUrl.replace(/\/$/, '')}/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-runner-secret': sharedSecret
      },
      body: JSON.stringify(this.buildRequest(input))
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Runner rejected job with ${response.status}.`);
    }

    if (!response.body) {
      return (await response.json()) as RunnerJobResult;
    }

    const result = await this.readStreamedResult(response.body, handlers);
    if (!result) {
      throw new ServiceUnavailableException('Runner response ended without a final result.');
    }
    return result;
  }

  private async readStreamedResult(body: ReadableStream<Uint8Array>, handlers: RunnerRunHandlers): Promise<RunnerJobResult | undefined> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const event = JSON.parse(trimmed) as RunnerStreamEvent;
        if (event.type === 'log') {
          await handlers.onLogLine?.(event.line);
          continue;
        }

        if (event.type === 'result') {
          return event.result;
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      const event = JSON.parse(tail) as RunnerStreamEvent;
      if (event.type === 'log') {
        await handlers.onLogLine?.(event.line);
      } else if (event.type === 'result') {
        return event.result;
      }
    }

    return undefined;
  }
}
