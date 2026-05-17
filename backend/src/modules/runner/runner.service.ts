import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunnerJobRequest, RunnerJobResult } from './runner.types';

@Injectable()
export class RunnerService {
  constructor(private readonly config: ConfigService) {}

  buildRequest(input: RunnerJobRequest): RunnerJobRequest {
    return {
      ...input,
      inputFiles: [...input.inputFiles]
    };
  }

  async run(input: RunnerJobRequest): Promise<RunnerJobResult> {
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

    return (await response.json()) as RunnerJobResult;
  }
}
