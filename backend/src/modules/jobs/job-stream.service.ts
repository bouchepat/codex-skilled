import { Injectable } from '@nestjs/common';

export type JobStreamEvent =
  | {
      type: 'log';
      line: string;
    }
  | {
      type: 'status';
      status: string;
      error?: string | null;
    };

type JobStreamListener = (event: JobStreamEvent) => void;

@Injectable()
export class JobStreamService {
  private readonly listeners = new Map<string, Set<JobStreamListener>>();

  subscribe(jobId: string, listener: JobStreamListener): () => void {
    const listeners = this.listeners.get(jobId) ?? new Set<JobStreamListener>();
    listeners.add(listener);
    this.listeners.set(jobId, listeners);

    return () => {
      const current = this.listeners.get(jobId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(jobId);
      }
    };
  }

  emit(jobId: string, event: JobStreamEvent): void {
    const listeners = this.listeners.get(jobId);
    if (!listeners?.size) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }
}
