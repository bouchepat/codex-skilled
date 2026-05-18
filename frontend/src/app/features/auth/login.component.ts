import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-screen">
      <div class="auth-panel">
        <div class="auth-brand">
          <span class="brand-icon large">CS</span>
          <h1>Codex Skilled</h1>
        </div>
        <p>Sign in to continue to your agent workspaces.</p>
        <button type="button" class="btn-console btn-primary-console auth-button" (click)="signIn()">
          <span class="google-dot">G</span>
          Continue with Google
        </button>
        <p class="auth-legal">Private research sessions, files, and generated artifacts stay scoped to your account.</p>
      </div>
    </section>
  `
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  protected signIn(): void {
    void this.auth.signInWithGoogle();
  }
}
