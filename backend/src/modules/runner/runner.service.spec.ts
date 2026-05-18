import { ConfigService } from '@nestjs/config';
import { RunnerService } from './runner.service';
import { RunnerJobRequest } from './runner.types';

describe('RunnerService', () => {
  it('builds an immutable runner request payload', () => {
    const service = new RunnerService(new ConfigService());
    const request: RunnerJobRequest = {
      jobId: 'job-1',
      userId: 'user-1',
      sessionId: 'session-1',
      appId: 'market-research',
      appName: 'Market Research',
      workspacePath: '/workspace/user-1/market-research/default',
      sessionPath: '/workspace/user-1/market-research/default/sessions/session-1',
      provider: 'codex',
      prompt: 'Research competitors',
      inputFiles: ['brief.md'],
      appPolicy: {
        allowedProviders: ['codex', 'claude'],
        requiredSkills: [
          { name: 'market-research', required: true },
          { name: 'pdf', required: true },
          { name: 'tavily-research', required: true },
          { name: 'chart', required: false }
        ],
        requiredArtifacts: [
          { label: 'Research report', mimeType: 'text/markdown', extension: 'md' },
          { label: 'Research PDF', mimeType: 'application/pdf', extension: 'pdf' }
        ],
        resumeSessions: true
      }
    };

    const built = service.buildRequest(request);
    request.inputFiles.push('later.md');

    expect(built).toEqual({
      ...request,
      inputFiles: ['brief.md']
    });
  });

  it('prefers RUNNER_URL over HOST_RUNNER_URL when available', async () => {
    const config = new ConfigService({
      RUNNER_URL: 'http://runner:4317',
      HOST_RUNNER_URL: 'http://host.docker.internal:4317',
      RUNNER_SHARED_SECRET: 'secret'
    });
    const service = new RunnerService(config);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'completed', logs: [], artifacts: [] })
    } as Response);

    await service.run({
      jobId: 'job-1',
      userId: 'user-1',
      sessionId: 'session-1',
      appId: 'market-research',
      appName: 'Market Research',
      workspacePath: '/workspace/user-1/market-research/default',
      sessionPath: '/workspace/user-1/market-research/default/sessions/session-1',
      provider: 'codex',
      prompt: 'Research competitors',
      inputFiles: [],
      appPolicy: {
        allowedProviders: ['codex', 'claude'],
        requiredSkills: [
          { name: 'market-research', required: true },
          { name: 'pdf', required: true },
          { name: 'tavily-research', required: true },
          { name: 'chart', required: false }
        ],
        requiredArtifacts: [
          { label: 'Research report', mimeType: 'text/markdown', extension: 'md' },
          { label: 'Research PDF', mimeType: 'application/pdf', extension: 'pdf' }
        ],
        resumeSessions: true
      }
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runner:4317/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-runner-secret': 'secret'
        })
      })
    );

    fetchSpy.mockRestore();
  });

  it('parses streamed runner log events before the final result', async () => {
    const config = new ConfigService({
      RUNNER_URL: 'http://runner:4317',
      RUNNER_SHARED_SECRET: 'secret'
    });
    const service = new RunnerService(config);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"log","line":"one"}\n{"type":"log","line":"two"}\n'));
        controller.enqueue(encoder.encode('{"type":"result","result":{"status":"completed","logs":["one","two"],"artifacts":[]}}\n'));
        controller.close();
      }
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: stream
    } as Response);
    const seen: string[] = [];

    const result = await service.run(
      {
        jobId: 'job-1',
        userId: 'user-1',
        sessionId: 'session-1',
        appId: 'market-research',
        appName: 'Market Research',
        workspacePath: '/workspace/user-1/market-research/default',
        sessionPath: '/workspace/user-1/market-research/default/sessions/session-1',
        provider: 'codex',
        prompt: 'Research competitors',
        inputFiles: [],
        appPolicy: {
        allowedProviders: ['codex', 'claude'],
        requiredSkills: [
          { name: 'market-research', required: true },
          { name: 'pdf', required: true },
          { name: 'tavily-research', required: true },
          { name: 'chart', required: false }
        ],
          requiredArtifacts: [
            { label: 'Research report', mimeType: 'text/markdown', extension: 'md' },
            { label: 'Research PDF', mimeType: 'application/pdf', extension: 'pdf' }
          ],
          resumeSessions: true
        }
      },
      {
        onLogLine: (line) => {
          seen.push(line);
        }
      }
    );

    expect(seen).toEqual(['one', 'two']);
    expect(result).toEqual({ status: 'completed', logs: ['one', 'two'], artifacts: [] });

    fetchSpy.mockRestore();
  });
});
