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
}

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

  async createJob(sessionId: string, provider: string, prompt: string, inputFiles: string[]): Promise<AgentJob> {
    return this.post<AgentJob>('/jobs', { sessionId, provider, prompt, inputFiles });
  }

  async listJobs(): Promise<AgentJob[]> {
    return this.get<AgentJob[]>('/jobs');
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
