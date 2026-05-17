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

  try {
    const result = await runAgentJob(request.body as RunnerJobRequest);
    response.json(result);
  } catch (error) {
    response.status(500).json({
      status: 'failed',
      logs: [],
      artifacts: [],
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Runner listening on http://localhost:${port}`);
});
