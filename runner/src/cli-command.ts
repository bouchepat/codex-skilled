import type { ApprovedSkill } from './skills.js';
import type { RunnerJobRequest } from './types.js';

export interface CliCommand {
  command: string;
  args: string[];
}

export function buildAgentPrompt(request: RunnerJobRequest & { approvedSkills: ApprovedSkill[] }): string {
  const inputList = request.inputFiles.length
    ? request.inputFiles.map((file) => `- ${file}`).join('\n')
    : '- No input files were selected.';

  const approvedSkillNames = request.appPolicy.requiredSkills.map((skill) => `- ${skill.name}`).join('\n');
  const approvedSkillDocs = request.approvedSkills
    .map((skill) => [`### ${skill.name}`, '```md', skill.content.trim(), '```'].join('\n'))
    .join('\n\n');
  const requiredArtifacts = request.appPolicy.requiredArtifacts
    .map((artifact) => `- ${artifact.label} (${artifact.mimeType})`)
    .join('\n');

  return [
    'You are running inside an app-specific user workspace.',
    'Complete the user request and write the final deliverable as a markdown report.',
    'Do not modify files outside the workspace.',
    'Do not do anything outside the approved app scope.',
    '',
    `App: ${request.appName} (${request.appId})`,
    `Workspace root: ${request.workspacePath}`,
    `Session path: ${request.sessionPath}`,
    `Session resumes previous artifacts: ${request.appPolicy.resumeSessions ? 'yes' : 'no'}`,
    '',
    'Approved skills:',
    approvedSkillNames,
    '',
    'Required artifacts:',
    requiredArtifacts,
    '',
    'Referenced files:',
    inputList,
    '',
    'Skill references:',
    approvedSkillDocs,
    '',
    'User request:',
    request.prompt
  ].join('\n');
}

export function buildCliCommand(provider: RunnerJobRequest['provider'], workspacePath: string, promptPath: string, outputPath: string): CliCommand {
  if (provider === 'codex') {
    return {
      command: 'codex',
      args: [
        'exec',
        '--cd',
        workspacePath,
        '--skip-git-repo-check',
        '--sandbox',
        'workspace-write',
        '--output-last-message',
        outputPath,
        '-'
      ]
    };
  }

  if (provider === 'claude') {
    return {
      command: 'claude',
      args: [
        '--print',
        '--permission-mode',
        'dontAsk',
        '--add-dir',
        workspacePath,
        '--output-format',
        'text'
      ]
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
