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
      <nav class="topbar">
        <div class="brand-cluster">
          <a class="brand-mark" routerLink="/apps" aria-label="Codex Skilled apps">
            <span class="brand-icon">CS</span>
            <span>Codex Skilled</span>
          </a>
          <span class="topbar-divider"></span>
          <span class="workspace-context">Agent workspace console</span>
        </div>
        <div class="topbar-actions">
            @if (userLabel()) {
            <span class="user-label">{{ userLabel() }}</span>
            <button type="button" class="btn-console btn-ghost" (click)="signOut()">Sign out</button>
            }
        </div>
      </nav>
      <main class="app-main">
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
