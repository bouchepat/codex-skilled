import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, AppDefinition, Workspace } from '../../shared/api.service';

@Component({
  selector: 'app-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="d-flex flex-column gap-4">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <h1 class="h2 fw-semibold mb-2">Choose an agent app</h1>
          <p class="muted mb-0">Start with Market Research, then extend the same workspace model to image and video workflows.</p>
        </div>
        <button type="button" class="btn btn-outline-primary" (click)="refresh()">Refresh</button>
      </div>

      @if (error()) {
        <div class="alert alert-danger">{{ error() }}</div>
      }

      <div class="row g-3">
        @for (app of apps(); track app.id) {
          <div class="col-12 col-md-6 col-xl-4">
            <button
              type="button"
              class="surface app-card text-start w-100 p-4 border-1"
              [class.enabled]="app.status === 'ENABLED'"
              [disabled]="app.status !== 'ENABLED'"
              (click)="openApp(app)"
            >
              <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                <h2 class="h5 fw-semibold mb-0">{{ app.name }}</h2>
                <span class="badge" [class.text-bg-primary]="app.status === 'ENABLED'" [class.text-bg-secondary]="app.status !== 'ENABLED'">
                  {{ app.status === 'ENABLED' ? 'Enabled' : 'Coming soon' }}
                </span>
              </div>
              <p class="muted mb-0">{{ app.description }}</p>
            </button>
          </div>
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
}

