import path from 'node:path';
import { buildWorkspaceRootPath, slugifyEmail, slugifyWorkspaceName } from './workspace-root';

describe('workspace root helpers', () => {
  it('slugifies email addresses into stable folder names', () => {
    expect(slugifyEmail('Jane.Doe@Example.com')).toBe('jane.doe');
  });

  it('slugifies workspace names', () => {
    expect(slugifyWorkspaceName('Default Workspace')).toBe('default-workspace');
    expect(slugifyWorkspaceName('   ')).toBe('default');
  });

  it('builds user-scoped workspace roots', () => {
    expect(buildWorkspaceRootPath('/workspace-data', 'Jane.Doe@Example.com', 'market-research', 'Default')).toBe(
      path.join('/workspace-data', 'jane.doe', 'market-research')
    );
  });
});
