import * as Sentry from '@sentry/react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'
import { useEffect } from 'react'
import { getAppPlatform, getAppVersion } from './platform'

const dsn = import.meta.env.VITE_SENTRY_DSN

const sharedConfig = {
  dsn,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE || getAppVersion(),
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  ignoreErrors: [
    'ResizeObserver loop',
    /ERR_BLOCKED_BY_CLIENT/,
    /Loading chunk [\d]+ failed/,
  ],
  initialScope: {
    tags: {
      app: 'menu-mestre-facil',
      platform: getAppPlatform(),
    },
  },
}

function initWebSentry(): void {
  Sentry.init({
    ...sharedConfig,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
  })
}

export async function initObservability(): Promise<void> {
  if (!dsn) {
    console.log('📢 Sentry: DSN não configurado — error tracking desabilitado.')
    return
  }

  const platform = getAppPlatform()

  if (platform === 'electron') {
    const { init: electronInit } = await import('@sentry/electron/renderer')
    const { init: reactInit } = await import('@sentry/react')

    electronInit(
      {
        ...sharedConfig,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.reactRouterV6BrowserTracingIntegration({
            useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes,
          }),
        ],
      },
      reactInit,
    )
  } else {
    initWebSentry()
  }
}
