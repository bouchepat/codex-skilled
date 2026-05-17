import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="row justify-content-center align-items-center" style="min-height: calc(100vh - 120px);">
      <div class="col-12 col-md-7 col-xl-5">
        <div class="surface p-4 p-md-5">
          <h1 class="h3 fw-semibold mb-3">Sign in to your agent workspaces</h1>
          <p class="muted mb-4">Use Google login to access private research sessions, files, and generated artifacts.</p>
          <button type="button" class="btn btn-primary w-100" (click)="signIn()">Continue with Google</button>
        </div>
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

