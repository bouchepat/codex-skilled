import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './features/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell">
      <nav class="navbar navbar-expand-lg bg-white border-bottom">
        <div class="container-fluid px-4">
          <a class="navbar-brand fw-semibold" routerLink="/apps">Codex Skilled</a>
          <div class="d-flex align-items-center gap-3">
            @if (userLabel()) {
              <span class="small muted">{{ userLabel() }}</span>
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="signOut()">Sign out</button>
            }
          </div>
        </div>
      </nav>
      <main class="container-fluid p-4">
        <router-outlet />
      </main>
    </div>
  `
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  protected readonly userLabel = computed(() => this.auth.user()?.email ?? '');

  protected signOut(): void {
    void this.auth.signOut();
  }
}

