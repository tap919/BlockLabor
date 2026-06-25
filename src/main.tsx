import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';
import { env } from './shared/lib/env';
import { AuthProvider } from './features/auth/AuthContext';

// Sentry initialization
Sentry.init({
  dsn: env.VITE_SENTRY_DSN || '',
  environment: env.VITE_SENTRY_ENV || 'development',
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [],
});

// Runtime check for Sentry DSN in production
if (import.meta.env.PROD && !env.VITE_SENTRY_DSN) {
  console.warn('Warning: Sentry DSN is missing in production. Error tracking will not be available.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Sentry.ErrorBoundary fallback={<>An error occurred</>}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Sentry.ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
