const prompt = process.env.SMOKE_PROMPT ?? 'Search for places to stop by and see for a road trip between maple ridge and ainsworth hot springs, we stay 3 nights at the hotel there, so the stops shoud be on the way there and on the way back.';
const jobId = process.env.SMOKE_JOB_ID ?? `smoke-${Date.now()}`;
const sessionId = process.env.SMOKE_SESSION_ID ?? jobId;
const workspacePath = process.env.SMOKE_WORKSPACE_PATH ?? '/workspace-data/bouchepat/market-research';
const sessionPath = process.env.SMOKE_SESSION_PATH ?? `${workspacePath}/codex/${sessionId}`;
const provider = process.env.SMOKE_PROVIDER ?? 'codex';

const body = {
  jobId,
  userId: process.env.SMOKE_USER_ID ?? 'bouchepat',
  sessionId,
  appId: process.env.SMOKE_APP_ID ?? 'market-research',
  appName: process.env.SMOKE_APP_NAME ?? 'Market Research',
  workspacePath,
  sessionPath,
  provider,
  prompt,
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
};

const res = await fetch('http://localhost:4317/jobs', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-runner-secret': process.env.RUNNER_SHARED_SECRET ?? 'change-me'
  },
  body: JSON.stringify(body)
});

const text = await res.text();
console.log(text);
