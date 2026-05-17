import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService, AgentJob, Session, WorkspaceFile } from '../../shared/api.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="d-flex flex-column gap-3">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1 class="h3 fw-semibold mb-1">Market Research Workspace</h1>
          <p class="muted mb-0">Chat with the research agent, manage source files, and download generated reports.</p>
        </div>
        <button type="button" class="btn btn-outline-primary" (click)="refresh()">Refresh</button>
      </div>

      @if (error()) {
        <div class="alert alert-danger">{{ error() }}</div>
      }

      <div class="workspace-grid">
        <aside class="surface p-3">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h2 class="h6 fw-semibold mb-0">Files</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="newFile()">New</button>
          </div>

          <input class="form-control form-control-sm mb-3" type="file" (change)="upload($event)" />

          <div class="file-list d-flex flex-column gap-2">
            @for (file of files(); track file.id) {
              <button type="button" class="btn btn-light text-start border" (click)="openFile(file.path)">
                <div class="fw-medium text-truncate">{{ file.path }}</div>
                <div class="small muted">{{ file.kind }} · {{ file.sizeBytes }} bytes</div>
              </button>
            }
          </div>
        </aside>

        <section class="surface p-3 editor-area">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <input class="form-control" style="max-width: 360px" [(ngModel)]="selectedPath" placeholder="notes/research.md" />
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-secondary" [disabled]="!selectedPath" (click)="downloadSelected()">Download</button>
              <button type="button" class="btn btn-primary" [disabled]="!selectedPath" (click)="saveFile()">Save</button>
            </div>
          </div>
          <textarea class="form-control font-monospace" rows="18" [(ngModel)]="fileContent" placeholder="Write notes, paste source material, or edit generated reports."></textarea>
        </section>

        <aside class="surface p-3 chat-area">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <h2 class="h6 fw-semibold mb-0">Research Chat</h2>
            <select class="form-select form-select-sm" style="width: 120px" [(ngModel)]="provider">
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold mb-1" for="session-select">Session</label>
            <select id="session-select" class="form-select form-select-sm" [ngModel]="activeSessionId()" (ngModelChange)="activeSessionId.set($event)">
              @for (session of sessions(); track session.id) {
                <option [value]="session.id">{{ session.title }} · {{ session.id }}</option>
              }
            </select>
            @if (activeSession()) {
              <div class="small muted mt-1">Continuing session {{ activeSession()!.id }}</div>
            }
          </div>

          <div class="chat-log p-3 mb-3">
            @for (message of chatMessages(); track message.id) {
              <div class="mb-3">
                <div class="small fw-semibold">{{ message.role }}</div>
                <div>{{ message.text }}</div>
              </div>
            }
          </div>

          <textarea class="form-control mb-2" rows="4" [(ngModel)]="prompt" placeholder="Ask for competitor analysis, market sizing, positioning, or report updates."></textarea>
          <button type="button" class="btn btn-primary w-100" [disabled]="!prompt.trim()" (click)="sendPrompt()">Run research task</button>

          <hr />
          <h3 class="h6 fw-semibold">Jobs</h3>
          <div class="d-flex flex-column gap-2">
            @for (job of jobs(); track job.id) {
              <div class="border rounded p-2">
                <div class="d-flex justify-content-between gap-2">
                  <span class="fw-medium">{{ job.provider }}</span>
                  <span class="badge text-bg-light">{{ job.status }}</span>
                </div>
                <div class="small muted text-truncate">{{ job.prompt }}</div>
              </div>
            }
          </div>
        </aside>
      </div>
    </section>
  `
})
export class WorkspaceComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly workspaceId = this.route.snapshot.paramMap.get('workspaceId') ?? '';
  protected readonly files = signal<WorkspaceFile[]>([]);
  protected readonly sessions = signal<Session[]>([]);
  protected readonly jobs = signal<AgentJob[]>([]);
  protected readonly error = signal('');
  protected readonly activeSessionId = signal('');
  protected readonly activeSession = computed(() => this.sessions().find((session) => session.id === this.activeSessionId()));
  protected readonly chatMessages = computed(() =>
    (this.activeSession()?.iterations ?? [])
      .map((iteration) => ({ id: iteration.id, role: `Iteration ${iteration.version}`, text: iteration.prompt }))
  );

  protected selectedPath = 'notes/research.md';
  protected fileContent = '';
  protected prompt = '';
  protected provider = 'codex';
  private refreshTimer: number | undefined;

  constructor() {
    void this.refresh();
    this.refreshTimer = window.setInterval(() => void this.refresh(), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
  }

  protected async refresh(): Promise<void> {
    try {
      this.error.set('');
      const [files, sessions, jobs] = await Promise.all([
        this.api.listFiles(this.workspaceId),
        this.api.listSessions(),
        this.api.listJobs()
      ]);
      const workspaceSessions = sessions.filter((session) => session.workspaceId === this.workspaceId);
      this.files.set(files);
      this.sessions.set(workspaceSessions);
      if (!this.activeSessionId() && workspaceSessions.length) {
        this.activeSessionId.set(workspaceSessions[0].id);
      } else if (this.activeSessionId() && !workspaceSessions.some((session) => session.id === this.activeSessionId())) {
        this.activeSessionId.set(workspaceSessions[0]?.id ?? '');
      }
      this.jobs.set(jobs.filter((job) => workspaceSessions.some((session) => session.id === job.sessionId)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load workspace.');
    }
  }

  protected newFile(): void {
    this.selectedPath = 'notes/research.md';
    this.fileContent = '';
  }

  protected async openFile(path: string): Promise<void> {
    this.selectedPath = path;
    this.fileContent = await this.api.readFile(this.workspaceId, path);
  }

  protected async saveFile(): Promise<void> {
    await this.api.writeFile(this.workspaceId, this.selectedPath, this.fileContent);
    await this.refresh();
  }

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    await this.api.uploadFile(this.workspaceId, `uploads/${file.name}`, file);
    input.value = '';
    await this.refresh();
  }

  protected downloadSelected(): void {
    void this.downloadSelectedFile();
  }

  protected async sendPrompt(): Promise<void> {
    const title = this.prompt.trim().slice(0, 80) || 'Market research';
    const session = this.activeSession() ?? (await this.api.createSession('market-research', this.workspaceId, title));
    this.activeSessionId.set(session.id);
    const inputFiles = this.selectedPath ? [this.selectedPath] : [];
    const job = await this.api.createJob(session.id, this.provider, this.prompt, inputFiles);
    this.jobs.update((current) => [job, ...current.filter((existing) => existing.id !== job.id)]);
    this.prompt = '';
    await this.refresh();
  }

  private async downloadSelectedFile(): Promise<void> {
    const headers = await this.api.downloadHeaders();
    const response = await fetch(this.api.downloadUrl(this.workspaceId, this.selectedPath), {
      headers: Object.fromEntries(headers.keys().map((key) => [key, headers.get(key) ?? '']))
    });
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = this.selectedPath.split('/').pop() ?? 'download';
    anchor.click();
    URL.revokeObjectURL(href);
  }
}
