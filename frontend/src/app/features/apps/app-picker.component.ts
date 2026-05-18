import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, AppDefinition, Workspace } from '../../shared/api.service';

@Component({
  selector: 'app-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-stack app-picker-page">
      <div class="page-header">
        <div>
          <p class="section-kicker">Codex Skilled</p>
          <h1>Choose an agent app</h1>
          <p>Start with Market Research, then extend the same workspace model to image and video workflows.</p>
        </div>
        <button type="button" class="btn-console btn-secondary-console" (click)="refresh()">Refresh</button>
      </div>

      @if (error()) {
        <div class="alert-console alert-danger-console">{{ error() }}</div>
      }

      <div class="app-catalog">
        @for (app of apps(); track app.id) {
          <button
            type="button"
            class="app-card"
            [class.enabled]="app.status === 'ENABLED'"
            [disabled]="app.status !== 'ENABLED'"
            (click)="openApp(app)"
          >
            <span class="app-glyph">{{ appGlyph(app.id) }}</span>
            <span class="app-card-copy">
              <span class="app-card-title">{{ app.name }}</span>
              <span>{{ app.description }}</span>
            </span>
            <span class="status-chip" [class.status-enabled]="app.status === 'ENABLED'" [class.status-disabled]="app.status !== 'ENABLED'">
              {{ app.status === 'ENABLED' ? 'Enabled' : 'Coming Soon' }}
            </span>
          </button>
        }
      </div>
    </section>
  `
})
export class AppPickerComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly apps = signal<AppDefinition[]>([]);
  protected readonly workspaces = signal<Workspace[]>([]);
  protected readonly error = signal('');

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    try {
      this.error.set('');
      const [apps, workspaces] = await Promise.all([this.api.listApps(), this.api.listWorkspaces()]);
      this.apps.set(apps);
      this.workspaces.set(workspaces);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load apps.');
    }
  }

  protected async openApp(app: AppDefinition): Promise<void> {
    if (app.status !== 'ENABLED') {
      return;
    }
    let workspace = this.workspaces().find((candidate) => candidate.appId === app.id && candidate.name === 'Default');
    workspace ??= await this.api.createWorkspace(app.id);
    await this.router.navigate(['/workspaces', workspace.id]);
  }

  protected appGlyph(appId: string): string {
    if (appId.includes('image')) {
      return 'IM';
    }
    if (appId.includes('video')) {
      return 'VD';
    }
    return 'MR';
  }
}
