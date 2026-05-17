import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { APP_CONFIG } from '../../config/app-config.providers';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(APP_CONFIG);
  private readonly router = inject(Router);
  private readonly firebaseApp = initializeApp(this.config.firebase);
  private readonly firebaseAuth = getAuth(this.firebaseApp);
  private readonly currentUser = signal<User | null>(null);
  private readonly authInitialized = signal(false);
  private readonly readyPromise: Promise<User | null>;

  readonly user = computed(() => this.currentUser());
  readonly isAuthenticated = computed(() => Boolean(this.currentUser()));
  readonly isReady = computed(() => this.authInitialized());

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.firebaseAuth, (user) => {
        this.currentUser.set(user);
        this.authInitialized.set(true);
        resolve(user);
        unsubscribe();
      });
    });
    onAuthStateChanged(this.firebaseAuth, (user) => {
      this.currentUser.set(user);
      this.authInitialized.set(true);
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.firebaseAuth, new GoogleAuthProvider());
    await this.router.navigateByUrl('/apps');
  }

  async signOut(): Promise<void> {
    await signOut(this.firebaseAuth);
    await this.router.navigateByUrl('/login');
  }

  async getIdToken(): Promise<string> {
    await this.ready();
    const user = this.currentUser();
    if (!user) {
      throw new Error('User is not signed in.');
    }
    return user.getIdToken();
  }

  async ready(): Promise<User | null> {
    if (this.authInitialized()) {
      return this.currentUser();
    }
    return this.readyPromise;
  }
}
