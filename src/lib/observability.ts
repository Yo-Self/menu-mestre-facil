import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { getAppPlatform, getAppVersion } from './platform'

export type ObservabilityContext = {
  restaurantId?: string | null
  userId?: string
}

function isSentryEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN)
}

function isPostHogEnabled(): boolean {
  return (
    Boolean(import.meta.env.VITE_POSTHOG_KEY) &&
    import.meta.env.VITE_POSTHOG_KEY !== 'phc_dummy_key_for_development' &&
    posthog.__loaded
  )
}

export function setObservabilityContext(ctx: ObservabilityContext): void {
  const platform = getAppPlatform()

  if (ctx.restaurantId) {
    Sentry.setTag('restaurant_id', ctx.restaurantId)
  }
  if (ctx.userId) {
    Sentry.setUser({ id: ctx.userId })
  }

  if (isPostHogEnabled()) {
    posthog.register({
      platform,
      app_version: getAppVersion(),
      ...(ctx.restaurantId ? { restaurant_id: ctx.restaurantId } : {}),
    })

    if (ctx.restaurantId) {
      posthog.group('restaurant', ctx.restaurantId, {
        name: `Restaurante #${ctx.restaurantId}`,
      })
    }
  }

  if (isSentryEnabled() && isPostHogEnabled()) {
    try {
      Sentry.setTag('posthog_distinct_id', posthog.get_distinct_id())
      Sentry.setTag('platform', platform)
    } catch {
      // ignore
    }
  }
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown> & {
    tags?: Record<string, string>
    feature?: string
  },
): string | undefined {
  const normalized =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')

  const { tags, feature, ...extra } = context ?? {}
  const platform = getAppPlatform()

  let sentryEventId: string | undefined
  if (isSentryEnabled()) {
    sentryEventId = Sentry.captureException(normalized, {
      extra,
      tags: {
        app: 'menu-mestre-facil',
        platform,
        ...(feature ? { feature } : {}),
        ...tags,
      },
    })
  }

  if (isPostHogEnabled()) {
    try {
      posthog.capture('technical_error', {
        error_name: normalized.name,
        error_message: normalized.message,
        feature_area: feature,
        platform,
        sentry_event_id: sentryEventId,
        ...extra,
      })
    } catch {
      // ignore
    }
  }

  return sentryEventId
}
