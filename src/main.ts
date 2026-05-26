// SockJS usa `global` de Node.js — polyfill necesario en el browser
(window as unknown as Record<string, unknown>)['global'] = window;

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
