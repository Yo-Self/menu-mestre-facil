export class UrlSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlSecurityError'
  }
}

const ALLOWED_HOST_SUFFIXES = [
  'ifood.com.br',
  'ifood-static.com.br',
]

function parseIpv4Octets(host: string): number[] | null {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
    return null
  }
  return parts
}

function isIpv4(host: string): boolean {
  return parseIpv4Octets(host) !== null
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const octets = parseIpv4Octets(host)
  if (!octets) return false

  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'metadata.google.internal' || host === 'metadata') return true

  if (isIpv4(host)) {
    return isPrivateOrReservedIpv4(host)
  }

  if (host.includes(':')) {
    if (host === '::1') return true
    if (host.startsWith('fe80:')) return true
    if (host.startsWith('fc') || host.startsWith('fd')) return true
  }

  return false
}

export function assertAllowedIfoodUrl(urlString: string): URL {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new UrlSecurityError('URL inválida')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlSecurityError('Protocolo não permitido')
  }

  if (parsed.username || parsed.password) {
    throw new UrlSecurityError('URL não permitida')
  }

  const hostname = parsed.hostname.toLowerCase()

  if (isPrivateOrReservedHost(hostname)) {
    throw new UrlSecurityError('URL não permitida')
  }

  const hostAllowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  )

  if (!hostAllowed) {
    throw new UrlSecurityError('Host não permitido')
  }

  return parsed
}

const MAX_REDIRECTS = 5

export async function safeFetch(
  urlString: string,
  init?: RequestInit,
): Promise<Response> {
  let current = assertAllowedIfoodUrl(urlString).href

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, { ...init, redirect: 'manual' })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        return response
      }

      current = assertAllowedIfoodUrl(new URL(location, current).href).href
      continue
    }

    return response
  }

  throw new UrlSecurityError('Muitos redirecionamentos')
}
