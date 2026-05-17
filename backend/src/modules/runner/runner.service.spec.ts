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
          { name: 'pdf', required: true }
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
});
