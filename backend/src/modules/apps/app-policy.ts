import { AppStatus, Prisma } from '@prisma/client';

export interface AppArtifactPolicy {
  label: string;
  mimeType: string;
  extension: string;
}

export interface AppSkillPolicy {
  name: string;
  required: boolean;
}

export interface AppExecutionPolicy {
  allowedProviders: Array<'codex' | 'claude'>;
  requiredSkills: AppSkillPolicy[];
  requiredArtifacts: AppArtifactPolicy[];
  resumeSessions: boolean;
}

export interface AppSeedDefinition {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  policy: Prisma.InputJsonValue;
}

export const MARKET_RESEARCH_POLICY: AppExecutionPolicy = {
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
};

export function getAppPolicy(appId: string): AppExecutionPolicy {
  if (appId === 'market-research') {
    return MARKET_RESEARCH_POLICY;
  }

  return {
    allowedProviders: [],
    requiredSkills: [],
    requiredArtifacts: [],
    resumeSessions: false
  };
}
