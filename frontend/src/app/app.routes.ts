import { Routes } from '@angular/router';
import { AppPickerComponent } from './features/apps/app-picker.component';
import { LoginComponent } from './features/auth/login.component';
import { WorkspaceComponent } from './features/workspace/workspace.component';
import { authGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'apps', component: AppPickerComponent, canActivate: [authGuard] },
  { path: 'workspaces/:workspaceId', component: WorkspaceComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'apps' },
  { path: '**', redirectTo: 'apps' }
];

