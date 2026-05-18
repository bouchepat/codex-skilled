import express from 'express';
import { runAgentJob } from './agent-runner.js';
import { RunnerJobRequest } from './types.js';
import { applyRunnerRuntimeEnv } from './runtime-env.js';

applyRunnerRuntimeEnv();

const app = express();
const port = Number(process.env.RUNNER_PORT ?? 4317);
const sharedSecret = process.env.RUNNER_SHARED_SECRET ?? 'change-me';

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, response) => {
  response.json({ ok: true });
});

app.post('/jobs', async (request, response) => {
  if (request.header('x-runner-secret') !== sharedSecret) {
    response.status(401).json({ error: 'Unauthorized runner request.' });
    return;
  }

  response.status(200);
  response.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
  response.setHeader('cache-control', 'no-cache, no-transform');
  response.setHeader('connection', 'keep-alive');
  response.flushHeaders?.();

  try {
    const result = await runAgentJob(request.body as RunnerJobRequest, {
      onLogLine: (line) => {
        response.write(`${JSON.stringify({ type: 'log', line })}\n`);
      }
    });
    response.write(`${JSON.stringify({ type: 'result', result })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Runner job failed before completion:', message);
    response.write(
      `${JSON.stringify({
        type: 'result',
        result: {
          status: 'failed',
          logs: [`Runner failed before invoking or completing the agent: ${message}`],
          artifacts: [],
          error: message
        }
      })}\n`
    );
  } finally {
    response.end();
  }
});

app.listen(port, () => {
  console.log(`Runner listening on http://localhost:${port}`);
});
