import { InjectionToken, Provider } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId?: string;
  };
}

type RuntimeAppConfig = Partial<Omit<AppConfig, 'firebase'>> & {
  firebase?: Partial<AppConfig['firebase']>;
};

declare global {
  interface Window {
    appConfig?: RuntimeAppConfig;
  }
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

const defaultConfig: AppConfig = {
  apiUrl: 'http://localhost:3000',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  }
};

export const appConfigProviders: Provider[] = [
  {
    provide: APP_CONFIG,
    useFactory: (): AppConfig => ({
      ...defaultConfig,
      ...(window.appConfig ?? {}),
      firebase: {
        ...defaultConfig.firebase,
        ...(window.appConfig?.firebase ?? {})
      }
    })
  }
];
