import type { ApprovedSkill } from './skills.js';
import type { RunnerJobRequest } from './types.js';
import { shouldUseAgentContainer } from './container-command.js';

export interface CliCommand {
  command: string;
  args: string[];
}

export function buildAgentPrompt(request: RunnerJobRequest & { approvedSkills: ApprovedSkill[] }): string {
  const inputList = request.inputFiles.length
    ? request.inputFiles.map((file) => `- ${file}`).join('\n')
    : '- No input files were selected.';

  const approvedSkillNames = request.approvedSkills.length
    ? request.approvedSkills.map((skill) => `- ${skill.name}`).join('\n')
    : '- No skills were baked into the image.';
  const requiredSkillNames = request.appPolicy.requiredSkills
    .map((skill) => `- ${skill.name}${skill.required ? ' (required)' : ' (optional)'}`)
    .join('\n');
  const approvedSkillDocs = request.approvedSkills
    .map((skill) => [`### ${skill.name}`, '```md', skill.content.trim(), '```'].join('\n'))
    .join('\n\n');
  const requiredArtifacts = request.appPolicy.requiredArtifacts
    .map((artifact) => `- ${artifact.label} (${artifact.mimeType})`)
    .join('\n');

  return [
    'You are running inside an app-specific user workspace.',
    'Complete the user request and write the final deliverable as a polished markdown report and PDF.',
    'Do not modify files outside the session path.',
    'Do not do anything outside the approved app scope.',
    '',
    `App: ${request.appName} (${request.appId})`,
    `Workspace root: ${request.workspacePath}`,
    `Session path: ${request.sessionPath}`,
    `Output folder: ${request.sessionPath}/outputs`,
    `Session resumes previous artifacts: ${request.appPolicy.resumeSessions ? 'yes' : 'no'}`,
    '',
    'Approved skills:',
    approvedSkillNames,
    '',
    'Required and optional skills:',
    requiredSkillNames,
    '',
    'Required artifacts:',
    requiredArtifacts,
    '',
    'Report quality contract:',
    '- Start with Tavily research for any factual, comparative, or market-oriented topic.',
    '- Use Tavily before any other web search path and do not rely on generic web search.',
    '- Verify important claims with additional authoritative sources before drafting.',
    '- Produce a report that is structured, specific, and publication-ready rather than a plain summary.',
    '- Include an executive summary, clear findings, recommendations, and sources.',
    '- Include comparison tables whenever options, products, or destinations are being evaluated.',
    '- Use the chart skill whenever numeric or comparative data benefits from a chart.',
    '- Include a Visuals section in every report; without it, the report is incomplete.',
    '- When the subject is concrete and imageable, use Tavily image search first and include at least one relevant sourced image or screenshot.',
    '- Save illustrative assets under outputs/assets and reference them with local markdown image paths.',
    '- If no suitable image is available, include a small diagram or callout and explain the limitation briefly.',
    '',
    'Referenced files:',
    inputList,
    '',
    'Skill references:',
    approvedSkillDocs,
    '',
    'User request:',
    request.prompt,
    '',
    'Write any markdown and PDF deliverables into the output folder. Use descriptive file names prefixed with today\'s date.'
  ].join('\n');
}

export function buildCliCommand(provider: RunnerJobRequest['provider'], workspacePath: string, promptPath: string, outputPath: string): CliCommand {
  if (provider === 'codex') {
    const sandboxMode = shouldUseAgentContainer()
      ? process.env.RUNNER_AGENT_SANDBOX_MODE ?? 'danger-full-access'
      : 'workspace-write';
    const args = [
      'exec',
      '--cd',
      workspacePath,
      '--skip-git-repo-check',
      '--sandbox',
      sandboxMode
    ];
    if (shouldUseAgentContainer()) {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    }
    args.push('--output-last-message', outputPath, '-');
    return {
      command: 'codex',
      args
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
