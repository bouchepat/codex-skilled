import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentJob, ApiService, Artifact, JobStreamEvent, Session } from '../../shared/api.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="workspace-page">
      <header class="workspace-command">
        <div class="workspace-title">
          <p class="section-kicker">Market Research</p>
          <h1>Market Research Workspace</h1>
          <p>Chat with a provider-backed research session and review the generated files.</p>
          <div class="workspace-metrics" aria-label="Workspace status">
            <span><strong>{{ sessions().length }}</strong> sessions</span>
            <span><strong>{{ generatedArtifacts().length }}</strong> files</span>
            <span><strong>{{ activeJobs().length }}</strong> jobs</span>
            <span><strong>{{ runnerLogLines().length }}</strong> log lines</span>
          </div>
        </div>
        <div class="command-controls">
          <label class="field-inline provider-field">
            <span>Provider</span>
            <select [(ngModel)]="provider">
              <option value="codex">Codex CLI</option>
              <option value="claude">Claude CLI</option>
            </select>
          </label>
          <button type="button" class="btn-console btn-secondary-console" (click)="refresh()">Refresh</button>
          <button type="button" class="btn-console btn-secondary-console" (click)="newSession()">New session</button>
          <button type="button" class="btn-console btn-danger-console" [disabled]="!activeSession()" (click)="deleteActiveSession()">Delete session</button>
          <button type="button" class="btn-console btn-secondary-console" [disabled]="!selectedPath" (click)="downloadSelected()">Download</button>
        </div>
      </header>

      @if (error()) {
        <div class="alert-console alert-danger-console">{{ error() }}</div>
      }

      <div class="workspace-grid session-workspace-grid">
        <aside class="console-panel file-panel" id="workspace-sessions">
          <div class="panel-heading">
            <h2>Sessions</h2>
            <span>{{ activeSession()?.status || 'No active session' }}</span>
          </div>

          <div class="session-list">
            @if (!sessions().length) {
              <div class="empty-state compact">No sessions yet. Send a message to create one.</div>
            }
            @for (session of sessions(); track session.id) {
              <div class="session-row" [class.selected]="session.id === activeSessionId()">
                <button type="button" class="session-open" (click)="selectSession(session.id)">
                  <span class="session-main">
                    <strong>{{ session.title }}</strong>
                    <small>{{ session.iterations.length }} messages / {{ session.status }}</small>
                  </span>
                  <span
                    class="status-chip"
                    [class.status-success]="isJobStatus(session.status, 'success')"
                    [class.status-running]="isJobStatus(session.status, 'running')"
                    [class.status-error]="isJobStatus(session.status, 'error')"
                    [class.status-muted]="isJobStatus(session.status, 'muted')"
                  >{{ session.status }}</span>
                </button>
                <button type="button" class="session-delete" aria-label="Delete session" (click)="deleteSession(session.id)">Delete</button>
              </div>
            }
          </div>

          <div class="panel-heading artifact-heading">
            <h2>Generated Files</h2>
            <span>{{ generatedArtifacts().length }} files</span>
          </div>
          <div class="file-list artifact-list">
            @if (!generatedArtifacts().length) {
              <div class="empty-state compact">Generated reports will appear here.</div>
            }
            @for (artifact of generatedArtifacts(); track artifact.id) {
              <button type="button" class="file-row" [class.selected]="artifact.file.path === selectedPath" (click)="openArtifact(artifact)">
                <span class="file-icon">{{ artifactIcon(artifact) }}</span>
                <span class="file-copy">
                  <span>{{ artifact.label }}</span>
                  <small>{{ artifact.file.path }}</small>
                </span>
              </button>
            }
          </div>
        </aside>

        <section class="console-panel editor-panel" id="workspace-files">
          <div class="editor-tabs">
            <div class="active-tab">
              <span class="file-icon">{{ selectedPreviewKind() === 'pdf' ? 'PDF' : 'MD' }}</span>
              <input [ngModel]="selectedPath || 'No generated file selected'" readonly />
            </div>
            <button type="button" class="btn-console btn-secondary-console in-panel-download" [disabled]="!selectedPath" (click)="downloadSelected()">Download</button>
          </div>
          <div class="artifact-notice">
            Results are generated by the active chat session. Direct file editing is disabled for now.
          </div>
          @if (selectedPreviewKind() === 'pdf' && selectedPdfUrl()) {
            <iframe class="pdf-viewer" [src]="selectedPdfUrl()" title="Generated PDF preview"></iframe>
          } @else {
            <pre class="artifact-viewer">{{ fileContent || 'Select a generated markdown or PDF file after a successful run.' }}</pre>
          }
          <footer class="editor-footer">
            <span>Words: {{ wordCount() }}</span>
            <span>Characters: {{ fileContent.length }}</span>
            <span class="saved-state">Generated</span>
          </footer>
        </section>

        <aside class="side-stack">
          <section class="console-panel chat-panel" id="workspace-chat">
            <div class="panel-heading">
              <h2>Research Chat</h2>
              <span>{{ activeSession()?.title || 'New session' }}</span>
            </div>

            <div class="chat-log">
              @for (message of chatMessages(); track message.id) {
                <div class="chat-message" [class.agent-message]="message.role !== 'You'">
                  <div class="message-role">{{ message.role }}</div>
                  <div>{{ message.text }}</div>
                </div>
              }
              @if (!chatMessages().length) {
                <div class="empty-state">Start with a market research request. Follow-up messages continue the same session.</div>
              }
            </div>

            <div class="composer">
              <textarea rows="4" [(ngModel)]="prompt" placeholder="Ask a research question or request changes to the generated report..."></textarea>
              <button type="button" class="btn-console btn-primary-console" [disabled]="!prompt.trim()" (click)="sendPrompt()">Run research task</button>
            </div>
          </section>

          <section class="console-panel jobs-panel" id="workspace-jobs">
            <div class="panel-heading">
              <h2>Jobs</h2>
              <button type="button" class="icon-link" (click)="refresh()">Refresh</button>
            </div>
            <div class="jobs-table">
              <div class="jobs-head">
                <span>Job</span>
                <span>Status</span>
                <span>Provider</span>
              </div>
              @for (job of activeJobs(); track job.id) {
                <div class="job-row">
                  <span>
                    <strong>{{ shortId(job.id) }}</strong>
                    <small>{{ job.prompt }}</small>
                    @if (job.status === 'FAILED' && failureDetail(job)) {
                      <small class="job-error">{{ failureDetail(job) }}</small>
                    }
                  </span>
                  <span
                    class="status-chip"
                    [class.status-success]="isJobStatus(job.status, 'success')"
                    [class.status-running]="isJobStatus(job.status, 'running')"
                    [class.status-error]="isJobStatus(job.status, 'error')"
                    [class.status-muted]="isJobStatus(job.status, 'muted')"
                  >{{ job.status }}</span>
                  <span>{{ job.provider }}</span>
                </div>
              }
              @if (!activeJobs().length) {
                <div class="empty-state compact">No jobs in this session yet.</div>
              }
            </div>
          </section>

          <section class="console-panel runner-panel" id="workspace-runner">
            <div class="panel-heading">
              <h2>Runner Output</h2>
              <span>{{ activeJobs().length }} jobs</span>
            </div>
            <div class="runner-log">
              @if (!runnerLogLines().length) {
                <div class="empty-state compact">Runner activity will appear here while work is queued, running, or complete.</div>
              }
              @for (line of runnerLogLines(); track line) {
                <div>{{ line }}</div>
              }
            </div>
          </section>
        </aside>
      </div>

      <nav class="mobile-workspace-tabs" aria-label="Workspace sections">
        <a href="#workspace-sessions">Sessions</a>
        <a href="#workspace-files">Files</a>
        <a href="#workspace-chat">Chat</a>
        <a href="#workspace-jobs">Jobs</a>
      </nav>
    </section>
  `
})
export class WorkspaceComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly workspaceId = this.route.snapshot.paramMap.get('workspaceId') ?? '';
  protected readonly sessions = signal<Session[]>([]);
  protected readonly jobs = signal<AgentJob[]>([]);
  protected readonly error = signal('');
  protected readonly activeSessionId = signal('');
  protected readonly activeSession = computed(() => this.sessions().find((session) => session.id === this.activeSessionId()));
  protected readonly activeJobs = computed(() => this.jobs().filter((job) => job.sessionId === this.activeSessionId()));
  protected readonly generatedArtifacts = computed(() => {
    const seen = new Set<string>();
    return this.activeJobs()
      .flatMap((job) => job.artifacts ?? [])
      .filter((artifact) => {
        if (seen.has(artifact.file.path)) {
          return false;
        }
        seen.add(artifact.file.path);
        return true;
      });
  });
  protected readonly chatMessages = computed(() => {
    const prompts = (this.activeSession()?.iterations ?? []).map((iteration) => ({
      id: `prompt-${iteration.id}`,
      role: 'You',
      text: iteration.prompt
    }));
    const jobSummaries = this.activeJobs()
      .filter((job) => job.status === 'COMPLETED' || job.status === 'FAILED')
      .map((job) => ({
        id: `job-${job.id}`,
        role: job.provider,
        text: job.status === 'COMPLETED'
          ? `Generated ${job.artifacts?.length ?? 0} file(s).`
          : `Job failed. ${this.failureDetail(job)}`
      }));
    return [...prompts, ...jobSummaries];
  });
  protected readonly runnerLogLines = computed(() => this.activeJobs().flatMap((job) => {
    const base = [
      `[${job.status}] ${job.provider} ${this.shortId(job.id)}`,
      `Prompt: ${job.prompt}`
    ];
    return [...base, ...(job.logs ?? [])];
  }));

  protected selectedPath = '';
  protected fileContent = '';
  protected readonly selectedPreviewKind = signal<'markdown' | 'pdf'>('markdown');
  protected readonly selectedPdfUrl = signal<SafeResourceUrl | null>(null);
  protected prompt = '';
  protected provider = 'codex';
  private refreshTimer: number | undefined;
  private readonly liveStreams = new Map<string, AbortController>();

  constructor() {
    void this.refresh();
    this.refreshTimer = window.setInterval(() => void this.refresh(), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
    for (const controller of this.liveStreams.values()) {
      controller.abort();
    }
    this.liveStreams.clear();
  }

  protected async refresh(): Promise<void> {
    try {
      this.error.set('');
      const [sessions, jobs] = await Promise.all([
        this.api.listSessions(),
        this.api.listJobs(this.workspaceId)
      ]);
      const workspaceSessions = sessions.filter((session) => session.workspaceId === this.workspaceId);
      this.sessions.set(workspaceSessions);
      this.jobs.set(jobs.filter((job) => workspaceSessions.some((session) => session.id === job.sessionId)));
      if (!this.activeSessionId() && workspaceSessions.length) {
        this.activeSessionId.set(workspaceSessions[0].id);
      } else if (this.activeSessionId() && !workspaceSessions.some((session) => session.id === this.activeSessionId())) {
        this.activeSessionId.set(workspaceSessions[0]?.id ?? '');
      }
      this.syncLiveStreams();
    } catch (error) {
      if (this.isNotFound(error)) {
        await this.router.navigate(['/apps']);
        return;
      }
      this.error.set(error instanceof Error ? error.message : 'Unable to load workspace.');
    }
  }

  protected selectSession(sessionId: string): void {
    this.activeSessionId.set(sessionId);
    this.clearSelectedArtifact();
    this.syncLiveStreams();
  }

  protected newSession(): void {
    this.activeSessionId.set('');
    this.clearSelectedArtifact();
    this.prompt = '';
    this.syncLiveStreams();
  }

  protected async deleteActiveSession(): Promise<void> {
    const session = this.activeSession();
    if (!session) {
      return;
    }
    await this.deleteSession(session.id);
  }

  protected async deleteSession(sessionId: string): Promise<void> {
    await this.api.deleteSession(sessionId);
    if (this.activeSessionId() === sessionId) {
      this.activeSessionId.set('');
      this.clearSelectedArtifact();
    }
    await this.refresh();
  }

  protected async openArtifact(artifact: Artifact): Promise<void> {
    this.selectedPath = artifact.file.path;
    if (artifact.file.mimeType === 'application/pdf') {
      this.selectedPreviewKind.set('pdf');
      this.fileContent = '';
      try {
        this.error.set('');
        const blob = await this.api.readFileBlob(this.workspaceId, artifact.file.path);
        const objectUrl = URL.createObjectURL(blob);
        this.selectedPdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
      } catch (error) {
        this.selectedPdfUrl.set(null);
        this.error.set(error instanceof Error ? error.message : 'Generated PDF could not be read.');
      }
      return;
    }
    try {
      this.error.set('');
      this.selectedPreviewKind.set('markdown');
      this.selectedPdfUrl.set(null);
      this.fileContent = await this.api.readFile(this.workspaceId, artifact.file.path);
    } catch (error) {
      this.fileContent = '';
      this.error.set(error instanceof Error ? error.message : 'Generated file could not be read.');
    }
  }

  protected downloadSelected(): void {
    if (this.selectedPath) {
      void this.downloadSelectedFile();
    }
  }

  protected async sendPrompt(): Promise<void> {
    const prompt = this.prompt.trim();
    if (!prompt) {
      return;
    }
    try {
      const session = this.activeSession() ?? (await this.api.createSession('market-research', this.workspaceId, prompt.slice(0, 80) || 'Market research'));
      this.activeSessionId.set(session.id);
      const job = await this.api.createJob(session.id, this.provider, prompt, []);
      this.jobs.update((current) => [job, ...current.filter((existing) => existing.id !== job.id)]);
      this.prompt = '';
      this.syncLiveStreams();
      await this.refresh();
    } catch (error) {
      if (this.isNotFound(error)) {
        await this.router.navigate(['/apps']);
        return;
      }
      this.error.set(error instanceof Error ? error.message : 'Unable to start research task.');
    }
  }

  protected artifactIcon(artifact: Artifact): string {
    return artifact.file.mimeType === 'application/pdf' ? 'PDF' : 'MD';
  }

  protected shortId(id: string): string {
    return id.length > 10 ? id.slice(0, 10) : id;
  }

  protected failureDetail(job: AgentJob): string {
    return job.error || job.logs?.slice(-1)[0] || '';
  }

  protected isJobStatus(status: string, target: 'success' | 'running' | 'error' | 'muted'): boolean {
    const normalized = status.toLowerCase();
    if (normalized.includes('complete') || normalized.includes('success')) {
      return target === 'success';
    }
    if (normalized.includes('run') || normalized.includes('pending') || normalized.includes('queue')) {
      return target === 'running';
    }
    if (normalized.includes('fail') || normalized.includes('error')) {
      return target === 'error';
    }
    return target === 'muted';
  }

  protected wordCount(): number {
    return this.fileContent.trim() ? this.fileContent.trim().split(/\s+/).length : 0;
  }

  private clearSelectedArtifact(): void {
    this.selectedPath = '';
    this.fileContent = '';
    this.selectedPreviewKind.set('markdown');
    this.selectedPdfUrl.set(null);
  }

  private syncLiveStreams(): void {
    const activeIds = new Set(
      this.activeJobs()
        .filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING')
        .map((job) => job.id)
    );

    for (const [jobId, controller] of this.liveStreams.entries()) {
      if (!activeIds.has(jobId)) {
        controller.abort();
        this.liveStreams.delete(jobId);
      }
    }

    for (const jobId of activeIds) {
      if (this.liveStreams.has(jobId)) {
        continue;
      }

      const controller = new AbortController();
      this.liveStreams.set(jobId, controller);
      void this.watchJob(jobId, controller);
    }
  }

  private async watchJob(jobId: string, controller: AbortController): Promise<void> {
    try {
      await this.api.streamJob(jobId, {
        signal: controller.signal,
        onEvent: (event) => this.applyJobEvent(jobId, event)
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      this.error.set(error instanceof Error ? error.message : 'Unable to stream job output.');
    } finally {
      this.liveStreams.delete(jobId);
    }
  }

  private applyJobEvent(jobId: string, event: JobStreamEvent): void {
    if (event.type === 'snapshot') {
      this.jobs.update((current) => this.mergeJob(current, event.job));
      return;
    }

    if (event.type === 'log') {
      this.jobs.update((current) => current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }
        return {
          ...job,
          logs: [...(job.logs ?? []), event.line]
        };
      }));
      return;
    }

    this.jobs.update((current) => current.map((job) => {
      if (job.id !== jobId) {
        return job;
      }
      return {
        ...job,
        status: event.status,
        error: event.error ?? job.error
      };
    }));
    if (event.status === 'COMPLETED' || event.status === 'FAILED') {
      void this.refresh();
    }
  }

  private mergeJob(current: AgentJob[], job: AgentJob): AgentJob[] {
    const index = current.findIndex((entry) => entry.id === job.id);
    if (index === -1) {
      return [job, ...current];
    }

    const merged = [...current];
    merged[index] = { ...merged[index], ...job };
    return merged;
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

  private isNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
  }
}
