export interface RunnerJobRequest {
  jobId: string;
  userId: string;
  sessionId: string;
  appId: string;
  appName: string;
  workspacePath: string;
  sessionPath: string;
  provider: string;
  prompt: string;
  inputFiles: string[];
  appPolicy: {
    allowedProviders: Array<'codex' | 'claude'>;
    requiredSkills: Array<{ name: string; required: boolean }>;
    requiredArtifacts: Array<{ label: string; mimeType: string; extension: string }>;
    resumeSessions: boolean;
  };
}

export interface RunnerArtifactManifest {
  path: string;
  label: string;
  mimeType?: string;
}

export interface RunnerJobResult {
  status: 'completed' | 'failed';
  logs: string[];
  artifacts: RunnerArtifactManifest[];
  error?: string;
}
