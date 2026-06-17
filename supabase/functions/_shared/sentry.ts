/**
 * Lightweight Sentry reporter for Supabase Edge Functions (Deno).
 */

function parseDsn(dsn: string): { key: string; host: string; projectId: string } | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\//, '')
    if (!url.username || !projectId) return null
    return { key: url.username, host: url.host, projectId }
  } catch {
    return null
  }
}

export async function captureEdgeException(
  error: unknown,
  options: {
    functionName: string
    extra?: Record<string, unknown>
    tags?: Record<string, string>
  },
): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) return

  const err = error instanceof Error ? error : new Error(String(error))
  const eventId = crypto.randomUUID().replace(/-/g, '')

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split('\n')
                  .slice(1, 6)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    tags: {
      runtime: 'deno',
      edge_function: options.functionName,
      app: 'menu-mestre-facil',
      ...options.tags,
    },
    extra: options.extra,
  }

  try {
    await fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=yo-self-edge/1.0`,
      },
      body: JSON.stringify(payload),
    })
  } catch (reportError) {
    console.error(`[sentry] Failed to report error from ${options.functionName}:`, reportError)
  }
}
