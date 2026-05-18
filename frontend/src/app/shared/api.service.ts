import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config.providers';
import { AuthService } from '../features/auth/auth.service';

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  status: 'ENABLED' | 'COMING_SOON';
}

export interface Workspace {
  id: string;
  appId: string;
  name: string;
  rootPath: string;
}

export interface WorkspaceFile {
  id: string;
  path: string;
  kind: 'UPLOAD' | 'GENERATED' | 'EDITABLE';
  mimeType?: string;
  sizeBytes: number | string;
}

export interface Artifact {
  id: string;
  label: string;
  file: WorkspaceFile;
}

export interface SessionIteration {
  id: string;
  version: number;
  prompt: string;
  inputRefs: string[];
  outputRefs: string[];
}

export interface Session {
  id: string;
  appId: string;
  workspaceId: string;
  title: string;
  status: string;
  iterations: SessionIteration[];
}

export interface AgentJob {
  id: string;
  sessionId: string;
  provider: string;
  status: string;
  prompt: string;
  logs: string[];
  error?: string;
  artifacts?: Artifact[];
}

export type JobStreamEvent =
  | {
      type: 'snapshot';
      job: AgentJob;
    }
  | {
      type: 'log';
      jobId: string;
      line: string;
    }
  | {
      type: 'status';
      jobId: string;
      status: string;
      error?: string | null;
    };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly config = inject(APP_CONFIG);

  async listApps(): Promise<AppDefinition[]> {
    return this.get<AppDefinition[]>('/apps');
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return this.get<Workspace[]>('/workspaces');
  }

  async createWorkspace(appId: string, name = 'Default'): Promise<Workspace> {
    return this.post<Workspace>('/workspaces', { appId, name });
  }

  async listFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    return this.get<WorkspaceFile[]>(`/workspaces/${workspaceId}/files`);
  }

  async writeFile(workspaceId: string, path: string, content: string): Promise<WorkspaceFile> {
    return this.post<WorkspaceFile>(`/workspaces/${workspaceId}/files`, { path, content });
  }

  async readFile(workspaceId: string, path: string): Promise<string> {
    return this.getText(`/workspaces/${workspaceId}/files/read?path=${encodeURIComponent(path)}`);
  }

  async readFileBlob(workspaceId: string, path: string): Promise<Blob> {
    return firstValueFrom(this.http.get(this.downloadUrl(workspaceId, path), {
      headers: await this.headers(false),
      responseType: 'blob'
    }));
  }

  async uploadFile(workspaceId: string, path: string, file: File): Promise<WorkspaceFile> {
    const form = new FormData();
    form.append('file', file);
    return this.postForm<WorkspaceFile>(`/workspaces/${workspaceId}/files/upload?path=${encodeURIComponent(path)}`, form);
  }

  downloadUrl(workspaceId: string, path: string): string {
    return `${this.config.apiUrl}/workspaces/${workspaceId}/files/download?path=${encodeURIComponent(path)}`;
  }

  async downloadHeaders(): Promise<HttpHeaders> {
    return this.headers(false);
  }

  async listSessions(): Promise<Session[]> {
    return this.get<Session[]>('/sessions');
  }

  async createSession(appId: string, workspaceId: string, title: string): Promise<Session> {
    return this.post<Session>('/sessions', { appId, workspaceId, title });
  }

  async deleteSession(sessionId: string): Promise<{ deleted: boolean; sessionId: string }> {
    return this.delete<{ deleted: boolean; sessionId: string }>(`/sessions/${sessionId}`);
  }

  async createJob(sessionId: string, provider: string, prompt: string, inputFiles: string[]): Promise<AgentJob> {
    return this.post<AgentJob>('/jobs', { sessionId, provider, prompt, inputFiles });
  }

  async listJobs(workspaceId?: string): Promise<AgentJob[]> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.get<AgentJob[]>(`/jobs${query}`);
  }

  async streamJob(jobId: string, handlers: {
    onEvent?: (event: JobStreamEvent) => void;
    signal?: AbortSignal;
  } = {}): Promise<void> {
    const headers = await this.streamHeaders();
    const response = await fetch(this.url(`/jobs/${jobId}/stream`), {
      headers,
      signal: handlers.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Unable to stream job ${jobId} (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}.`
      );
    }

    if (!response.body) {
      throw new Error(`Unable to stream job ${jobId} (missing response body).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        handlers.onEvent?.(JSON.parse(trimmed) as JobStreamEvent);
      }
    }

    const tail = buffer.trim();
    if (tail) {
      handlers.onEvent?.(JSON.parse(tail) as JobStreamEvent);
    }
  }

  private async get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.url(path), { headers: await this.headers() }));
  }

  private async getText(path: string): Promise<string> {
    return firstValueFrom(this.http.get(this.url(path), { headers: await this.headers(), responseType: 'text' }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body, { headers: await this.headers() }));
  }

  private async postForm<T>(path: string, body: FormData): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body, { headers: await this.headers(false) }));
  }

  private async delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.url(path), { headers: await this.headers() }));
  }

  private async streamHeaders(): Promise<HeadersInit> {
    const headers = await this.headers();
    return Object.fromEntries(headers.keys().map((key) => [key, headers.get(key) ?? '']));
  }

  private async headers(json = true): Promise<HttpHeaders> {
    const token = await this.auth.getIdToken();
    let headers = new HttpHeaders({ authorization: `Bearer ${token}` });
    if (json) {
      headers = headers.set('content-type', 'application/json');
    }
    return headers;
  }

  private url(path: string): string {
    return `${this.config.apiUrl}${path}`;
  }
}
