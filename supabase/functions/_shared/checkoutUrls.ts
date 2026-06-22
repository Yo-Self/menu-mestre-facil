const DEFAULT_SITE_URL = 'https://yo-self.com'

function siteBaseUrl(): string {
  const raw =
    Deno.env.get('SITE_URL') ??
    Deno.env.get('PUBLIC_SITE_URL') ??
    Deno.env.get('NEXT_PUBLIC_SITE_URL') ??
    DEFAULT_SITE_URL
  return raw.replace(/\/$/, '')
}

function queryParamsFromUrl(urlString: string): URLSearchParams {
  const queryIndex = urlString.indexOf('?')
  if (queryIndex < 0) return new URLSearchParams()
  return new URLSearchParams(urlString.slice(queryIndex + 1))
}

/**
 * InfinitePay only accepts HTTP(S) redirect URLs. Native apps (iOS) send custom
 * schemes like yoself-app:// — map those to a public HTTPS fallback while keeping
 * order_id (and optional access token) for post-payment flows.
 */
export function resolveInfinitePayRedirectUrl(
  successUrl: string,
  orderId: string,
  restaurantSlug?: string | null,
): string {
  try {
    const parsed = new URL(successUrl)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }
  } catch {
    // Custom scheme or malformed URL — fall through to HTTPS fallback.
  }

  const params = queryParamsFromUrl(successUrl)
  params.set('payment_success', 'true')
  params.set('payment_provider', 'infinitepay')
  params.set('payment_method', 'infinitepay_pix')
  params.set('capture_method', 'pix')
  params.set('order_id', orderId)

  const token = params.get('token')
  if (token && !params.has('access_token')) {
    params.set('access_token', token)
  }

  // Universal Links on yo-self.com only match /restaurant/* — use that path so iOS opens the app.
  const path = restaurantSlug?.trim()
    ? `/restaurant/${encodeURIComponent(restaurantSlug.trim())}/`
    : '/'

  return `${siteBaseUrl()}${path}?${params.toString()}`
}
